import { GatewayState } from '../types/env';
import {
  GatewayMessage,
  GatewayOpcode,
  GatewayPayload,
} from '../types/discord';
import { DiscordService } from './discord';
import { createLogger } from '../utils/logger';

const logger = createLogger('GatewayConnection');

const DEFAULT_HEARTBEAT_INTERVAL = 41250;

export interface GatewayConnectionHandlers {
  getState(): GatewayState;
  onSequence(sequence: number): Promise<void>;
  onHeartbeatAck(timestamp: number): Promise<void>;
  onHeartbeatSent(timestamp: number): Promise<void>;
  onReady(sessionId: string, userName?: string): Promise<void>;
  onResumed(): Promise<void>;
  onMessage(message: GatewayMessage): Promise<void>;
  onClose(code: number, reason: string | null): Promise<void>;
  onReconnectRequested(): Promise<void>;
  onInvalidSession(resumable: boolean): Promise<void>;
}

export class GatewayConnection {
  private discord: DiscordService;
  private handlers: GatewayConnectionHandlers;
  private ws: WebSocket | null = null;
  private heartbeatTimer: number | null = null;
  private awaitingHeartbeatAck = false;
  private closedByManager = false;

  constructor(discord: DiscordService, handlers: GatewayConnectionHandlers) {
    this.discord = discord;
    this.handlers = handlers;
  }

  connect(url: string): void {
    if (this.isActive()) {
      return;
    }

    logger.info('Opening Discord Gateway socket', { url });
    const ws = new WebSocket(url);
    this.ws = ws;
    this.setupHandlers(ws);
  }

  isActive(): boolean {
    return (
      this.ws !== null &&
      (this.ws.readyState === WebSocket.CONNECTING ||
        this.ws.readyState === WebSocket.OPEN)
    );
  }

  close(code?: number, reason?: string): void {
    this.closedByManager = true;
    this.stopHeartbeat();

    if (!this.ws) {
      return;
    }

    try {
      this.ws.close(code, reason);
    } catch (error) {
      logger.debug('Error closing Discord socket', { error });
    } finally {
      this.ws = null;
    }
  }

  private setupHandlers(ws: WebSocket): void {
    ws.addEventListener('message', async (event) => {
      try {
        const payload = JSON.parse(event.data as string) as GatewayPayload;
        await this.handlePayload(payload, ws);
      } catch (error) {
        logger.error('Error handling gateway payload', error as Error);
      }
    });

    ws.addEventListener('close', (event) => {
      this.stopHeartbeat();

      if (this.ws === ws) {
        this.ws = null;
      }

      logger.info('Discord Gateway socket closed', {
        code: event.code,
        reason: event.reason,
        closedByManager: this.closedByManager,
      });

      this.handlers.onClose(event.code, event.reason || null).catch((error) => {
        logger.error('Error handling socket close', error as Error);
      });
    });

    ws.addEventListener('error', (event) => {
      logger.error('Discord Gateway socket error', event as any);
    });
  }

  private async handlePayload(payload: GatewayPayload, ws: WebSocket): Promise<void> {
    if (payload.s !== null && payload.s !== undefined) {
      await this.handlers.onSequence(payload.s);
    }

    switch (payload.op) {
      case GatewayOpcode.Hello:
        await this.handleHello(payload, ws);
        break;

      case GatewayOpcode.Heartbeat:
        await this.sendHeartbeat(ws);
        break;

      case GatewayOpcode.HeartbeatACK:
        this.awaitingHeartbeatAck = false;
        await this.handlers.onHeartbeatAck(Date.now());
        logger.debug('Heartbeat acknowledged');
        break;

      case GatewayOpcode.Dispatch:
        await this.handleDispatch(payload);
        break;

      case GatewayOpcode.Reconnect:
        logger.info('Discord requested reconnect');
        await this.handlers.onReconnectRequested();
        break;

      case GatewayOpcode.InvalidSession:
        logger.warn('Discord invalidated session', { resumable: payload.d === true });
        await this.handlers.onInvalidSession(payload.d === true);
        break;

      default:
        logger.debug('Unhandled gateway opcode', { op: payload.op });
    }
  }

  private async handleHello(payload: GatewayPayload, ws: WebSocket): Promise<void> {
    const heartbeatInterval =
      typeof payload.d?.heartbeat_interval === 'number'
        ? payload.d.heartbeat_interval
        : DEFAULT_HEARTBEAT_INTERVAL;

    logger.info('Received Gateway Hello', { heartbeatInterval });
    this.startHeartbeat(heartbeatInterval, ws);
    this.identifyOrResume(ws);
  }

  private async handleDispatch(payload: GatewayPayload): Promise<void> {
    switch (payload.t) {
      case 'READY':
        await this.handlers.onReady(payload.d.session_id, payload.d.user?.username);
        break;

      case 'RESUMED':
        await this.handlers.onResumed();
        break;

      case 'MESSAGE_CREATE':
        await this.handlers.onMessage(payload.d as GatewayMessage);
        break;

      default:
        logger.debug('Unhandled dispatch event', { event: payload.t });
    }
  }

  private startHeartbeat(interval: number, ws: WebSocket): void {
    this.stopHeartbeat();
    this.awaitingHeartbeatAck = false;

    this.heartbeatTimer = setInterval(() => {
      if (this.awaitingHeartbeatAck) {
        logger.warn('Heartbeat ACK timeout, reconnecting');
        this.close(4000, 'Heartbeat ACK timeout');
        return;
      }

      this.sendHeartbeat(ws).catch((error) => {
        logger.error('Failed to send heartbeat', error as Error);
      });
    }, interval) as any;

    // Discord 建议客户端可以立即发送一次心跳，减少失活窗口。
    this.sendHeartbeat(ws).catch((error) => {
      logger.error('Failed to send initial heartbeat', error as Error);
    });
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    this.awaitingHeartbeatAck = false;
  }

  private identifyOrResume(ws: WebSocket): void {
    const state = this.handlers.getState();

    if (state.sessionId && state.sequence !== null) {
      logger.info('Resuming Discord session', {
        sessionId: state.sessionId,
        sequence: state.sequence,
      });
      this.sendPayload(ws, this.discord.createResumePayload(state.sessionId, state.sequence));
      return;
    }

    logger.info('Identifying Discord session');
    this.sendPayload(ws, this.discord.createIdentifyPayload());
  }

  private async sendHeartbeat(ws: WebSocket): Promise<void> {
    const sequence = this.handlers.getState().sequence;
    this.sendPayload(ws, this.discord.createHeartbeatPayload(sequence));
    this.awaitingHeartbeatAck = true;
    await this.handlers.onHeartbeatSent(Date.now());
    logger.debug('Heartbeat sent', { sequence });
  }

  private sendPayload(ws: WebSocket, payload: GatewayPayload): void {
    try {
      ws.send(JSON.stringify(payload));
    } catch (error) {
      logger.error('Failed to send gateway payload', error as Error, { op: payload.op });
      this.close(4000, 'Send failed');
    }
  }
}
