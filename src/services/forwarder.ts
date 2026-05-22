// 消息转发服务

import { Env } from '../types/env';
import { GatewayMessage } from '../types/discord';
import { createLogger } from '../utils/logger';

const logger = createLogger('MessageForwarder');

export interface ForwardResult {
  success: boolean;
  status?: number;
  error?: string;
}

export class MessageForwarder {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  // 转发消息到目标 API
  async forwardMessage(message: GatewayMessage): Promise<ForwardResult> {
    const targetUrl = this.env.TARGET_API_URL;
    
    if (!targetUrl) {
      logger.error('TARGET_API_URL is not configured');
      return { success: false, error: 'Target URL not configured' };
    }

    try {
      logger.info('Forwarding message', {
        messageId: message.id,
        author: `${message.author.username}#${message.author.discriminator}`,
        channelId: message.channel_id,
      });

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GoMsg/1.0',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const responseText = await response.text();
        logger.error('Failed to forward message', undefined, {
          status: response.status,
          statusText: response.statusText,
          response: responseText,
          messageId: message.id,
        });
        
        return {
          success: false,
          status: response.status,
          error: response.statusText,
        };
      }

      logger.info('Message forwarded successfully', {
        messageId: message.id,
        status: response.status,
      });

      return {
        success: true,
        status: response.status,
      };
    } catch (error) {
      logger.error('Error forwarding message', error as Error, {
        messageId: message.id,
      });
      
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }
}

// 创建转发器实例的工厂函数
export function createForwarder(env: Env): MessageForwarder {
  return new MessageForwarder(env);
}
