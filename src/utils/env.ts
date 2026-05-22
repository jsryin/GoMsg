import { Env } from '../types/env';

export function getEnv(env: Env): Env {
  return env;
}

export function validateEnv(env: Env): void {
  const requiredVars: (keyof Env)[] = [
    'DISCORD_TOKEN',
    'DISCORD_PUBLIC_KEY',
    'DISCORD_APPLICATION_ID',
    'TARGET_API_URL',
  ];

  for (const varName of requiredVars) {
    if (!env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  }
}

export function getDiscordToken(env: Env): string {
  return env.DISCORD_TOKEN;
}

export function getDiscordPublicKey(env: Env): string {
  return env.DISCORD_PUBLIC_KEY;
}

export function getDiscordApplicationId(env: Env): string {
  return env.DISCORD_APPLICATION_ID;
}

export function getTargetApiUrl(env: Env): string {
  return env.TARGET_API_URL;
}

export function getGatewayManager(env: Env): DurableObjectNamespace {
  return env.GATEWAY_MANAGER;
}
