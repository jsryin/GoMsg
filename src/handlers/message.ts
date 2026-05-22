// 消息处理器

import { Env } from '../types/env';
import { GatewayMessage } from '../types/discord';
import { MessageForwarder, createForwarder } from '../services/forwarder';
import { createLogger } from '../utils/logger';

const logger = createLogger('MessageHandler');

export class MessageHandler {
  private env: Env;
  private forwarder: MessageForwarder;

  constructor(env: Env) {
    this.env = env;
    this.forwarder = createForwarder(env);
  }

  // 处理消息
  async handleMessage(message: GatewayMessage): Promise<void> {
    logger.info('Processing message', {
      messageId: message.id,
      author: `${message.author.username}#${message.author.discriminator}`,
      channelId: message.channel_id,
      contentLength: message.content.length,
    });

    // 打印消息详情
    this.logMessageDetails(message);

    // 转发消息
    const result = await this.forwarder.forwardMessage(message);
    
    if (!result.success) {
      logger.error('Message forwarding failed', undefined, {
        messageId: message.id,
        error: result.error,
        status: result.status,
      });
    }
  }

  // 打印消息详情
  private logMessageDetails(message: GatewayMessage): void {
    logger.info('Message details', {
      id: message.id,
      channel_id: message.channel_id,
      guild_id: message.guild_id,
      author: {
        id: message.author.id,
        username: message.author.username,
        discriminator: message.author.discriminator,
        bot: message.author.bot,
      },
      content: message.content,
      timestamp: message.timestamp,
      tts: message.tts,
      mention_everyone: message.mention_everyone,
      pinned: message.pinned,
      type: message.type,
    });
  }
}

// 创建处理器实例的工厂函数
export function createMessageHandler(env: Env): MessageHandler {
  return new MessageHandler(env);
}