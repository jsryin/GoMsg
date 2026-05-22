// Discord Interactions 处理器

import { Env } from '../types/env';
import { DiscordInteraction } from '../types/discord';
import { DiscordService } from '../services/discord';
import { createLogger } from '../utils/logger';

const logger = createLogger('InteractionHandler');

export class InteractionHandler {
  private env: Env;
  private discord: DiscordService;

  constructor(env: Env) {
    this.env = env;
    this.discord = new DiscordService(env);
  }

  // 处理 Interaction 请求
  async handleRequest(request: Request): Promise<Response> {
    // 验证请求方法
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    // 获取签名头
    const signature = request.headers.get('X-Signature-Ed25519');
    const timestamp = request.headers.get('X-Signature-Timestamp');

    if (!signature || !timestamp) {
      logger.warn('Missing signature headers');
      return new Response('Missing signature', { status: 401 });
    }

    // 读取请求体
    const body = await request.text();

    // 验证签名
    const isValid = await this.discord.verifySignature(body, signature, timestamp);
    if (!isValid) {
      logger.warn('Invalid signature');
      return new Response('Invalid signature', { status: 401 });
    }

    // 解析 Interaction
    let interaction: DiscordInteraction;
    try {
      interaction = JSON.parse(body);
    } catch (error) {
      logger.error('Failed to parse interaction', error as Error);
      return new Response('Invalid JSON', { status: 400 });
    }

    // 处理 PING 类型
    if (interaction.type === 1) {
      logger.info('Responding to PING');
      return new Response(JSON.stringify({ type: 1 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 其他类型暂不处理
    logger.info('Received interaction', {
      type: interaction.type,
      id: interaction.id,
    });

    return new Response('OK', { status: 200 });
  }
}

// 创建处理器实例的工厂函数
export function createInteractionHandler(env: Env): InteractionHandler {
  return new InteractionHandler(env);
}