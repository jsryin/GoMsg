// Discord API 封装

import { Env } from '../types/env';
import { GatewayPayload, GatewayOpcode, GatewayIntent } from '../types/discord';
import { createLogger } from '../utils/logger';

const logger = createLogger('DiscordService');

const DISCORD_GATEWAY_URL = 'wss://gateway.discord.gg/?v=10&encoding=json';

export class DiscordService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  // 获取 Gateway URL
  getGatewayUrl(): string {
    return DISCORD_GATEWAY_URL;
  }

  // 创建 IDENTIFY 负载
  createIdentifyPayload(): GatewayPayload {
    return {
      op: GatewayOpcode.Identify,
      d: {
        token: this.env.DISCORD_TOKEN,
        intents:
          GatewayIntent.Guilds |
          GatewayIntent.GuildMessages |
          GatewayIntent.MessageContent,
        properties: {
          os: 'cloudflare-workers',
          browser: 'gomsg',
          device: 'gomsg',
        },
      },
    };
  }

  // 创建心跳负载
  createHeartbeatPayload(sequence: number | null): GatewayPayload {
    return {
      op: GatewayOpcode.Heartbeat,
      d: sequence,
    };
  }

  // 创建 RESUME 负载
  createResumePayload(sessionId: string, sequence: number): GatewayPayload {
    return {
      op: GatewayOpcode.Resume,
      d: {
        token: this.env.DISCORD_TOKEN,
        session_id: sessionId,
        seq: sequence,
      },
    };
  }

  // 验证 Discord 请求签名
  async verifySignature(
    body: string,
    signature: string,
    timestamp: string
  ): Promise<boolean> {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(timestamp + body);
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(this.env.DISCORD_PUBLIC_KEY),
        { name: 'Ed25519' },
        false,
        ['verify']
      );

      const signatureBuffer = hexToUint8Array(signature);
      const isValid = await crypto.subtle.verify(
        'Ed25519',
        key,
        signatureBuffer,
        data
      );

      return isValid;
    } catch (error) {
      logger.error('Signature verification failed', error as Error);
      return false;
    }
  }
}

// 辅助函数：十六进制字符串转 Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const pairs = hex.match(/[\dA-F]{2}/gi);
  if (!pairs) {
    throw new Error('Invalid hex string');
  }

  const integers = pairs.map((pair) => parseInt(pair, 16));
  return new Uint8Array(integers);
}
