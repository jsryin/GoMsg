// 环境变量类型定义

export interface Env {
  // Discord 配置
  DISCORD_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
  
  // 目标 API 配置
  TARGET_API_URL: string;
  
  // Durable Objects 绑定
  GATEWAY_MANAGER: DurableObjectNamespace;
}

// Durable Objects 状态
export interface GatewayState {
  sequence: number | null;
  sessionId: string | null;
  lastHeartbeat: number;
  connected: boolean;
  lastCloseCode: number | null;
  lastCloseReason: string | null;
}
