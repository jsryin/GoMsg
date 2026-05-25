// Discord Gateway 管理器 (Durable Object)

import { Env, GatewayState } from './types/env';
import { GatewayMessage } from './types/discord';
import { DiscordService } from './services/discord';
import { MessageForwarder, createForwarder } from './services/forwarder';
import { GatewayConnection } from './services/gateway-connection';
import {
  canResumeInvalidSession,
  getReconnectDelay,
  shouldReconnect,
  shouldResetSession,
} from './services/gateway-policy';
import { createLogger } from './utils/logger';

const logger = createLogger('GatewayManager');

const STATE_KEY = 'gateway-state';

export class GatewayManager {
  private state: DurableObjectState;
  private env: Env;
  private discord: DiscordService;
  private forwarder: MessageForwarder;
  private connection: GatewayConnection | null = null;
  private gatewayState: GatewayState = createInitialState();
  private initialized: Promise<void>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.discord = new DiscordService(env);
    this.forwarder = createForwarder(env);
    this.initialized = this.state.blockConcurrencyWhile(async () => {
      await this.loadState();
    });
  }

  async fetch(request: Request): Promise<Response> {
    await this.initialized;
    const url = new URL(request.url);

    if (url.pathname === '/connect') {
      await this.ensureConnected();
      return this.json(this.gatewayState);
    }

    if (url.pathname === '/status') {
      await this.reconcileRuntimeState();
      return this.json(this.gatewayState);
    }

    return new Response('GatewayManager is running');
  }

  async alarm(): Promise<void> {
    await this.initialized;

    if (this.hasActiveConnection() || this.gatewayState.status === 'fatal') {
      return;
    }

    logger.info('Reconnect alarm fired', {
      attempts: this.gatewayState.reconnectAttempts,
    });
    await this.connect();
  }

  async ensureConnected(): Promise<void> {
    if (this.hasActiveConnection()) {
      logger.info('Gateway connection already active', {
        status: this.gatewayState.status,
      });
      return;
    }

    if (this.gatewayState.status === 'fatal') {
      logger.warn('Gateway is in fatal state, skip reconnect', {
        closeCode: this.gatewayState.lastCloseCode,
      });
      return;
    }

    await this.connect();
  }

  close(): void {
    const connection = this.connection;
    this.connection = null;
    connection?.close(1000, 'Manager closed');

    this.gatewayState.connected = false;
    this.gatewayState.status = 'disconnected';
    this.gatewayState.nextReconnectAt = null;
    this.persistState().catch((error) => {
      logger.error('Failed to persist closed state', error as Error);
    });
  }

  private async connect(): Promise<void> {
    if (this.hasActiveConnection()) {
      return;
    }

    await this.clearReconnectAlarm();
    this.gatewayState.connected = false;
    this.gatewayState.status = 'connecting';
    this.gatewayState.lastCloseCode = null;
    this.gatewayState.lastCloseReason = null;
    this.gatewayState.nextReconnectAt = null;
    await this.persistState();

    const gatewayUrl = this.discord.getGatewayUrl();
    const connection = this.createConnection();
    this.connection = connection;

    try {
      connection.connect(gatewayUrl);
    } catch (error) {
      logger.error('Failed to open Discord Gateway socket', error as Error);
      if (this.connection === connection) {
        this.connection = null;
      }
      await this.scheduleReconnect();
    }
  }

  private createConnection(): GatewayConnection {
    let connection: GatewayConnection;

    connection = new GatewayConnection(this.discord, {
      getState: () => this.gatewayState,

      onSequence: async (sequence) => {
        this.gatewayState.sequence = sequence;
        await this.persistState();
      },

      onHeartbeatSent: async (timestamp) => {
        this.gatewayState.lastHeartbeatSentAt = timestamp;
        await this.persistState();
      },

      onHeartbeatAck: async (timestamp) => {
        this.gatewayState.lastHeartbeat = timestamp;
        this.gatewayState.lastHeartbeatSentAt = null;
        await this.persistState();
      },

      onReady: async (sessionId, userName) => {
        this.gatewayState.sessionId = sessionId;
        this.gatewayState.connected = true;
        this.gatewayState.status = 'connected';
        this.gatewayState.reconnectAttempts = 0;
        this.gatewayState.nextReconnectAt = null;
        await this.persistState();
        logger.info('Connected to Discord', { sessionId, user: userName });
      },

      onResumed: async () => {
        this.gatewayState.connected = true;
        this.gatewayState.status = 'connected';
        this.gatewayState.reconnectAttempts = 0;
        this.gatewayState.nextReconnectAt = null;
        await this.persistState();
        logger.info('Resumed Discord session');
      },

      onMessage: async (message) => {
        await this.handleMessageCreate(message);
      },

      onClose: async (code, reason) => {
        if (this.connection !== connection) {
          logger.debug('Ignoring stale Gateway close event', { code, reason });
          return;
        }

        this.connection = null;
        await this.handleConnectionClose(code, reason);
      },

      onReconnectRequested: async () => {
        if (this.connection !== connection) {
          return;
        }

        this.connection = null;
        connection.close(4000, 'Discord requested reconnect');
        await this.scheduleReconnect();
      },

      onInvalidSession: async (resumable) => {
        if (this.connection !== connection) {
          return;
        }

        if (!canResumeInvalidSession(resumable)) {
          this.resetSession();
        }

        this.connection = null;
        connection.close(4000, 'Invalid session');
        await this.scheduleReconnect();
      },
    });

    return connection;
  }

  private async handleConnectionClose(code: number, reason: string | null): Promise<void> {
    logger.info('Discord Gateway closed', { code, reason });

    this.gatewayState.connected = false;
    this.gatewayState.lastCloseCode = code;
    this.gatewayState.lastCloseReason = reason;
    this.gatewayState.lastHeartbeatSentAt = null;

    if (shouldResetSession(code)) {
      this.resetSession();
    }

    if (!shouldReconnect(code)) {
      this.gatewayState.status = 'fatal';
      this.gatewayState.nextReconnectAt = null;
      await this.persistState();
      logger.warn('Fatal Discord Gateway close code, reconnect disabled', { code });
      return;
    }

    await this.scheduleReconnect();
  }

  private async scheduleReconnect(): Promise<void> {
    this.gatewayState.connected = false;
    this.gatewayState.status = 'reconnecting';
    this.gatewayState.reconnectAttempts += 1;

    const delay = getReconnectDelay(this.gatewayState.reconnectAttempts);
    const nextReconnectAt = Date.now() + delay;
    this.gatewayState.nextReconnectAt = nextReconnectAt;

    await this.persistState();
    await this.state.storage.setAlarm(nextReconnectAt);

    logger.info('Scheduled Gateway reconnect', {
      delay,
      attempts: this.gatewayState.reconnectAttempts,
    });
  }

  private async reconcileRuntimeState(): Promise<void> {
    if (
      !this.hasActiveConnection() &&
      (this.gatewayState.connected || this.gatewayState.status === 'connecting')
    ) {
      this.gatewayState.connected = false;
      this.gatewayState.status = 'reconnecting';
      this.gatewayState.nextReconnectAt = Date.now();
      await this.persistState();
      await this.state.storage.setAlarm(Date.now());
    }
  }

  private async loadState(): Promise<void> {
    const storedState = await this.state.storage.get<GatewayState>(STATE_KEY);
    this.gatewayState = normalizeState(storedState);

    // Durable Object 重新实例化后没有内存 socket，连接状态需要重新建立。
    if (this.gatewayState.connected || this.gatewayState.status === 'connecting') {
      this.gatewayState.connected = false;
      this.gatewayState.status = 'reconnecting';
      this.gatewayState.nextReconnectAt = Date.now();
      await this.persistState();
      await this.state.storage.setAlarm(Date.now());
    }
  }

  private async persistState(): Promise<void> {
    await this.state.storage.put(STATE_KEY, this.gatewayState);
  }

  private async clearReconnectAlarm(): Promise<void> {
    await this.state.storage.deleteAlarm();
  }

  private hasActiveConnection(): boolean {
    return this.connection?.isActive() ?? false;
  }

  private async handleMessageCreate(message: GatewayMessage): Promise<void> {
    logger.info('Message received', {
      messageId: message.id,
      author: `${message.author.username}#${message.author.discriminator}`,
      channelId: message.channel_id,
      content: message.content.substring(0, 100),
    });

    this.forwarder.forwardMessage(message).catch((error) => {
      logger.error('Failed to forward message', error as Error, {
        messageId: message.id,
      });
    });
  }

  private resetSession(): void {
    this.gatewayState.sessionId = null;
    this.gatewayState.sequence = null;
  }

  private json(data: unknown): Response {
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function createInitialState(): GatewayState {
  return {
    sequence: null,
    sessionId: null,
    lastHeartbeat: 0,
    lastHeartbeatSentAt: null,
    reconnectAttempts: 0,
    connected: false,
    status: 'idle',
    lastCloseCode: null,
    lastCloseReason: null,
    nextReconnectAt: null,
  };
}

function normalizeState(state: GatewayState | undefined): GatewayState {
  return {
    ...createInitialState(),
    ...state,
  };
}

export default GatewayManager;
