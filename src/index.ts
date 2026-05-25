// Cloudflare Workers 主入口

import { Env } from './types/env';
import { createInteractionHandler } from './handlers/interaction';
import { createLogger } from './utils/logger';
import { validateEnv } from './utils/env';

const logger = createLogger('Worker');

// 导出 Durable Object 类
export { GatewayManager } from './gateway';

export default {
  // 处理 HTTP 请求
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    logger.info('Received request', {
      method: request.method,
      pathname: url.pathname,
    });

    // 验证环境变量
    try {
      validateEnv(env);
    } catch (error) {
      logger.error('Environment validation failed', error as Error);
      return new Response('Configuration error', { status: 500 });
    }

    // 处理 Interactions 端点
    if (url.pathname === '/interactions') {
      const handler = createInteractionHandler(env);
      return handler.handleRequest(request);
    }

    // 处理 Gateway 连接请求
    if (url.pathname === '/connect') {
      const gatewayId = env.GATEWAY_MANAGER.idFromName('discord-gateway');
      const gateway = env.GATEWAY_MANAGER.get(gatewayId);
      return gateway.fetch(new Request('https://internal/connect'));
    }

    // 处理 Gateway 状态查询
    if (url.pathname === '/status') {
      const gatewayId = env.GATEWAY_MANAGER.idFromName('discord-gateway');
      const gateway = env.GATEWAY_MANAGER.get(gatewayId);
      return gateway.fetch(new Request('https://internal/status'));
    }

    // 健康检查
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not found', { status: 404 });
  },

  // 处理定时事件（可选）
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    logger.info('Scheduled event triggered', {
      scheduledTime: new Date(event.scheduledTime).toISOString(),
    });

    // 确保 Gateway 连接
    const gatewayId = env.GATEWAY_MANAGER.idFromName('discord-gateway');
    const gateway = env.GATEWAY_MANAGER.get(gatewayId);
    
    try {
      await gateway.fetch(new Request('https://internal/connect'));
      logger.info('Gateway connection ensured');
    } catch (error) {
      logger.error('Failed to initiate gateway connection', error as Error);
    }
  },
};
