// src/gateway.ts
// Discord Gateway 管理器 (Durable Objects)

import { Env, GatewayState } from './types/env';
import {
  GatewayPayload,
  GatewayOpcode,
  GatewayMessage,
} from './types/discord';
import { DiscordService } from './services/discord';
import { MessageForwarder, createForwarder } from './services/forwarder';
import {
  canResumeInvalidSession,
  shouldReconnect,
  shouldResetSession,
} from './services/gateway-policy';
import { createLogger } from './utils/logger';

const logger = createLogger('GatewayManager');

// 心跳间隔（毫秒）
const HEARTBEAT_INTERVAL = 41250;

// 重连延迟（毫秒）
const RECONNECT_DELAY = 5000;

// 最大重连延迟（毫秒）
const MAX_RECONNECT_DELAY = 60000;

export class GatewayManager {
  private state: DurableObjectState;
  private env: Env;
  private discord: DiscordService;
  private forwarder: MessageForwarder;
  private ws: WebSocket | null = null;
  private heartbeatInterval: number | null = null;
  private reconnectTimeout: number | null = null;
  private gatewayState: GatewayState;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.discord = new DiscordService(env);
    this.forwarder = createForwarder(env);
    this.gatewayState = {
      sequence: null,
      sessionId: null,
      lastHeartbeat: 0,
      connected: false,
      status: 'idle',
      lastCloseCode: null,
      lastCloseReason: null,
      nextReconnectAt: null,
    };
  }

  // 处理 HTTP 请求
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/connect') {
      await this.ensureConnected();
      return new Response(JSON.stringify(this.gatewayState), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (url.pathname === '/status') {
      return new Response(JSON.stringify(this.gatewayState), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('GatewayManager is running');
  }

  // 确保 Gateway 已连接；重复调用不会关闭已有连接。
  async ensureConnected(): Promise<void> {
    if (this.hasActiveSocket()) {
      logger.info('Gateway connection already active', {
        status: this.gatewayState.status,
      });
      return;
    }

    await this.connect();
  }

  // 连接到 Discord Gateway
  private async connect(): Promise<void> {
    if (this.hasActiveSocket()) {
      return;
    }

    try {
      const gatewayUrl = this.discord.getGatewayUrl();
      logger.info('Connecting to Discord Gateway', { url: gatewayUrl });

      // 连接到 Discord Gateway
      const discordWs = new WebSocket(gatewayUrl);
      this.ws = discordWs;
      this.gatewayState.connected = false;
      this.gatewayState.status = 'connecting';
      this.gatewayState.lastCloseCode = null;
      this.gatewayState.lastCloseReason = null;
      this.gatewayState.nextReconnectAt = null;
      this.setupDiscordHandlers(discordWs);

      logger.info('WebSocket connection established');
    } catch (error) {
      logger.error('Failed to connect to Discord Gateway', error as Error);
      this.scheduleReconnect();
    }
  }

  // 设置 Discord WebSocket 事件处理器
  private setupDiscordHandlers(ws: WebSocket): void {
    ws.addEventListener('message', async (event) => {
      try {
        const payload: GatewayPayload = JSON.parse(event.data as string);
        await this.handleGatewayPayload(payload, ws);
      } catch (error) {
        logger.error('Error handling gateway message', error as Error);
      }
    });

    ws.addEventListener('close', (event) => {
      logger.info('Discord WebSocket closed', {
        code: event.code,
        reason: event.reason,
      });
      if (this.ws !== ws) {
        logger.debug('Ignoring stale WebSocket close event');
        return;
      }

      this.gatewayState.connected = false;
      this.gatewayState.lastCloseCode = event.code;
      this.gatewayState.lastCloseReason = event.reason || null;
      this.gatewayState.status = 'disconnected';
      this.gatewayState.nextReconnectAt = null;
      this.ws = null;
      this.stopHeartbeat();

      if (shouldResetSession(event.code)) {
        this.resetSession();
      }

      // 检查是否需要重连，认证/Intent 等致命错误不能循环重试。
      if (shouldReconnect(event.code)) {
        this.scheduleReconnect();
      }
    });

    ws.addEventListener('error', (event) => {
      logger.error('Discord WebSocket error', event as any);
    });
  }

  // 处理 Gateway 负载
  private async handleGatewayPayload(
    payload: GatewayPayload,
    ws: WebSocket
  ): Promise<void> {
    // 更新序列号
    if (payload.s !== null && payload.s !== undefined) {
      this.gatewayState.sequence = payload.s;
    }

    switch (payload.op) {
      case GatewayOpcode.Hello:
        await this.handleHello(payload, ws);
        break;

      case GatewayOpcode.Heartbeat:
        this.sendHeartbeat(ws);
        break;

      case GatewayOpcode.HeartbeatACK:
        this.gatewayState.lastHeartbeat = Date.now();
        logger.debug('Heartbeat acknowledged');
        break;

      case GatewayOpcode.Dispatch:
        await this.handleDispatch(payload);
        break;

      case GatewayOpcode.Reconnect:
        logger.info('Received reconnect request');
        this.close();
        this.scheduleReconnect();
        break;

      case GatewayOpcode.InvalidSession:
        logger.warn('Invalid session, will reconnect', { resumable: payload.d });
        if (!canResumeInvalidSession(payload.d)) {
          this.resetSession();
        }
        this.close();
        this.scheduleReconnect();
        break;

      default:
        logger.debug('Unhandled opcode', { op: payload.op });
    }
  }

  // 处理 Hello 事件
  private async handleHello(payload: GatewayPayload, ws: WebSocket): Promise<void> {
    const heartbeatInterval = payload.d?.heartbeat_interval;
    logger.info('Received Hello', { heartbeatInterval });

    // 启动心跳
    this.startHeartbeat(heartbeatInterval || HEARTBEAT_INTERVAL, ws);

    // 发送 IDENTIFY 或 RESUME
    if (this.gatewayState.sessionId && this.gatewayState.sequence !== null) {
      logger.info('Resuming session', {
        sessionId: this.gatewayState.sessionId,
        sequence: this.gatewayState.sequence,
      });
      const resumePayload = this.discord.createResumePayload(
        this.gatewayState.sessionId,
        this.gatewayState.sequence
      );
      this.sendPayload(ws, resumePayload);
    } else {
      logger.info('Identifying with Discord');
      const identifyPayload = this.discord.createIdentifyPayload();
      this.sendPayload(ws, identifyPayload);
    }
  }

  // 处理 Dispatch 事件
  private async handleDispatch(payload: GatewayPayload): Promise<void> {
    const { t: eventName, d: data } = payload;

    switch (eventName) {
      case 'READY':
        this.gatewayState.sessionId = data.session_id;
        this.gatewayState.connected = true;
        this.gatewayState.status = 'connected';
        this.gatewayState.nextReconnectAt = null;
        logger.info('Connected to Discord', {
          sessionId: data.session_id,
          user: data.user?.username,
        });
        break;

      case 'RESUMED':
        this.gatewayState.connected = true;
        this.gatewayState.status = 'connected';
        this.gatewayState.nextReconnectAt = null;
        logger.info('Resumed Discord session');
        break;

      case 'MESSAGE_CREATE':
        await this.handleMessageCreate(data as GatewayMessage);
        break;

      default:
        logger.debug('Unhandled dispatch event', { event: eventName });
    }
  }

  // 处理消息创建事件
  private async handleMessageCreate(message: GatewayMessage): Promise<void> {
    logger.info('Message received', {
      messageId: message.id,
      author: `${message.author.username}#${message.author.discriminator}`,
      channelId: message.channel_id,
      content: message.content.substring(0, 100),
    });

    // 异步转发消息，不阻塞事件处理
    this.forwarder.forwardMessage(message).catch((error) => {
      logger.error('Failed to forward message', error as Error, {
        messageId: message.id,
      });
    });
  }

  // 启动心跳
  private startHeartbeat(interval: number, ws: WebSocket): void {
    this.stopHeartbeat();
    
    const heartbeatFn = () => {
      this.sendHeartbeat(ws);
    };

    // 首次心跳在 interval 后发送
    this.heartbeatInterval = setInterval(heartbeatFn, interval) as any;
    
    // 立即发送一次心跳
    this.sendHeartbeat(ws);
  }

  // 停止心跳
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // 发送心跳
  private sendHeartbeat(ws: WebSocket): void {
    const heartbeatPayload = this.discord.createHeartbeatPayload(
      this.gatewayState.sequence
    );
    this.sendPayload(ws, heartbeatPayload);
    logger.debug('Heartbeat sent', { sequence: this.gatewayState.sequence });
  }

  // 发送负载
  private sendPayload(ws: WebSocket, payload: GatewayPayload): void {
    try {
      ws.send(JSON.stringify(payload));
    } catch (error) {
      logger.error('Failed to send payload', error as Error, { op: payload.op });
    }
  }

  // 安排重连
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    // 指数退避
    const delay = Math.min(
      RECONNECT_DELAY * Math.pow(2, Math.random()),
      MAX_RECONNECT_DELAY
    );

    this.gatewayState.connected = false;
    this.gatewayState.status = 'reconnecting';
    this.gatewayState.nextReconnectAt = Date.now() + delay;

    logger.info('Scheduling reconnect', { delay });

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, delay) as any;
  }

  // 关闭连接
  close(): void {
    this.stopHeartbeat();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch (error) {
        logger.debug('Error closing WebSocket', { error });
      }
      this.ws = null;
    }

    this.gatewayState.connected = false;
    this.gatewayState.status = 'disconnected';
    this.gatewayState.nextReconnectAt = null;
  }

  // 清除不可恢复的 session 信息，避免下一次错误地 Resume。
  private resetSession(): void {
    this.gatewayState.sessionId = null;
    this.gatewayState.sequence = null;
  }

  // CONNECTING/OPEN 都视为活跃，避免重复 Identify 触发 Discord 限制。
  private hasActiveSocket(): boolean {
    return (
      this.ws !== null &&
      (this.ws.readyState === WebSocket.CONNECTING ||
        this.ws.readyState === WebSocket.OPEN)
    );
  }
}

// 导出 Durable Object 类
export default GatewayManager;
