# Discord 消息转发器实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建部署在 Cloudflare Workers 上的 Discord 机器人，监听所有消息并转发到指定 API

**Architecture:** 使用 Durable Objects 维持 Discord Gateway WebSocket 连接，Workers 处理消息转发

**Tech Stack:** TypeScript, Cloudflare Workers, Durable Objects, Discord API v10

---

## Task 1: 初始化项目结构

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `wrangler.toml`
- Create: `.dev.vars.example`

**Step 1: 创建 package.json**

```json
{
  "name": "gomsg",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240512.0",
    "typescript": "^5.4.5",
    "wrangler": "^3.57.0"
  }
}
```

**Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 3: 创建 wrangler.toml**

```toml
name = "gomsg"
main = "src/index.ts"
compatibility_date = "2024-05-12"
compatibility_flags = ["nodejs_compat"]

[durable_objects]
bindings = [
  { name = "GATEWAY_MANAGER", class_name = "GatewayManager" }
]

[[migrations]]
tag = "v1"
new_classes = ["GatewayManager"]

[vars]
DISCORD_APPLICATION_ID = ""
TARGET_API_URL = ""
```

**Step 4: 创建 .dev.vars.example**

```
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_PUBLIC_KEY=your_discord_public_key_here
```

**Step 5: 安装依赖并验证**

Run: `npm install && npm run typecheck`
Expected: 无错误

**Step 6: Commit**

```bash
git add package.json tsconfig.json wrangler.toml .dev.vars.example
git commit -m "feat: 初始化项目结构"
```

---

## Task 2: 实现类型定义

**Files:**
- Create: `src/types/discord.ts`
- Create: `src/types/env.ts`

**Step 1: 创建 Discord 类型定义**

```typescript
// src/types/discord.ts
// Discord Gateway 事件类型定义

export interface GatewayPayload {
  op: number;
  d?: any;
  s?: number;
  t?: string;
}

export interface GatewayMessage {
  id: string;
  channel_id: string;
  guild_id?: string;
  author: GatewayUser;
  member?: GatewayMember;
  content: string;
  timestamp: string;
  edited_timestamp?: string;
  tts: boolean;
  mention_everyone: boolean;
  mentions: GatewayUser[];
  mention_roles: string[];
  attachments: GatewayAttachment[];
  embeds: GatewayEmbed[];
  reactions?: GatewayReaction[];
  nonce?: string | number;
  pinned: boolean;
  webhook_id?: string;
  type: number;
  activity?: GatewayMessageActivity;
  application?: GatewayApplication;
  application_id?: string;
  message_reference?: GatewayMessageReference;
  flags?: number;
  referenced_message?: GatewayMessage;
  interaction?: GatewayMessageInteraction;
  thread?: GatewayChannel;
  components?: GatewayComponent[];
  sticker_items?: GatewaySticker[];
  position?: number;
}

export interface GatewayUser {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string;
  avatar?: string;
  bot?: boolean;
  system?: boolean;
  mfa_enabled?: boolean;
  banner?: string;
  accent_color?: number;
  locale?: string;
  verified?: boolean;
  email?: string;
  flags?: number;
  premium_type?: number;
  public_flags?: number;
  avatar_decoration?: string;
}

export interface GatewayMember {
  user?: GatewayUser;
  nick?: string;
  avatar?: string;
  roles: string[];
  joined_at: string;
  premium_since?: string;
  deaf: boolean;
  mute: boolean;
  flags: number;
  pending?: boolean;
  permissions?: string;
  communication_disabled_until?: string;
}

export interface GatewayAttachment {
  id: string;
  filename: string;
  description?: string;
  content_type?: string;
  size: number;
  url: string;
  proxy_url: string;
  height?: number;
  width?: number;
  ephemeral?: boolean;
}

export interface GatewayEmbed {
  title?: string;
  type?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: GatewayEmbedFooter;
  image?: GatewayEmbedImage;
  thumbnail?: GatewayEmbedThumbnail;
  video?: GatewayEmbedVideo;
  provider?: GatewayEmbedProvider;
  author?: GatewayEmbedAuthor;
  fields?: GatewayEmbedField[];
}

export interface GatewayEmbedFooter {
  text: string;
  icon_url?: string;
  proxy_icon_url?: string;
}

export interface GatewayEmbedImage {
  url: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

export interface GatewayEmbedThumbnail {
  url: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

export interface GatewayEmbedVideo {
  url?: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

export interface GatewayEmbedProvider {
  name?: string;
  url?: string;
}

export interface GatewayEmbedAuthor {
  name?: string;
  url?: string;
  icon_url?: string;
  proxy_icon_url?: string;
}

export interface GatewayEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface GatewayReaction {
  count: number;
  me: boolean;
  emoji: GatewayEmoji;
}

export interface GatewayEmoji {
  id?: string;
  name?: string;
  roles?: string[];
  user?: GatewayUser;
  require_colons?: boolean;
  managed?: boolean;
  animated?: boolean;
  available?: boolean;
}

export interface GatewayMessageActivity {
  type: number;
  party_id?: string;
}

export interface GatewayApplication {
  id: string;
  name: string;
  icon?: string;
  description: string;
  rpc_origins?: string[];
  bot_public: boolean;
  bot_require_code_grant: boolean;
  terms_of_service_url?: string;
  privacy_policy_url?: string;
  owner?: GatewayUser;
  summary: string;
  verify_key: string;
  team?: GatewayTeam;
  guild_id?: string;
  primary_sku_id?: string;
  slug?: string;
  cover_image?: string;
  flags?: number;
}

export interface GatewayTeam {
  icon?: string;
  id: string;
  members: GatewayTeamMember[];
  name: string;
  owner_user_id: string;
}

export interface GatewayTeamMember {
  membership_state: number;
  permissions: string[];
  team_id: string;
  user: GatewayUser;
}

export interface GatewayMessageReference {
  message_id?: string;
  channel_id?: string;
  guild_id?: string;
  fail_if_not_exists?: boolean;
}

export interface GatewayMessageInteraction {
  id: string;
  type: number;
  name: string;
  user: GatewayUser;
  member?: GatewayMember;
}

export interface GatewayChannel {
  id: string;
  type: number;
  guild_id?: string;
  position?: number;
  permission_overwrites?: GatewayOverwrite[];
  name?: string;
  topic?: string;
  nsfw?: boolean;
  last_message_id?: string;
  bitrate?: number;
  user_limit?: number;
  rate_limit_per_user?: number;
  recipients?: GatewayUser[];
  icon?: string;
  owner_id?: string;
  application_id?: string;
  parent_id?: string;
  last_pin_timestamp?: string;
  rtc_region?: string;
  video_quality_mode?: number;
  message_count?: number;
  member_count?: number;
  thread_metadata?: GatewayThreadMetadata;
  member?: GatewayThreadMember;
  default_auto_archive_duration?: number;
  permissions?: string;
  flags?: number;
  total_message_sent?: number;
  available_tags?: GatewayForumTag[];
  applied_tags?: string[];
  default_reaction_emoji?: GatewayDefaultReaction;
  default_thread_rate_limit_per_user?: number;
  default_sort_order?: number;
  default_forum_layout?: number;
}

export interface GatewayOverwrite {
  id: string;
  type: number;
  allow: string;
  deny: string;
}

export interface GatewayThreadMetadata {
  archived: boolean;
  auto_archive_duration: number;
  archive_timestamp: string;
  locked: boolean;
  invitable?: boolean;
  create_timestamp?: string;
}

export interface GatewayThreadMember {
  id?: string;
  user_id?: string;
  join_timestamp: string;
  flags: number;
  member?: GatewayMember;
}

export interface GatewayForumTag {
  id: string;
  name: string;
  moderated: boolean;
  emoji_id?: string;
  emoji_name?: string;
}

export interface GatewayDefaultReaction {
  emoji_id?: string;
  emoji_name?: string;
}

export interface GatewayComponent {
  type: number;
  custom_id?: string;
  disabled?: boolean;
  style?: number;
  label?: string;
  emoji?: GatewayEmoji;
  url?: string;
  options?: GatewaySelectOption[];
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  components?: GatewayComponent[];
}

export interface GatewaySelectOption {
  label: string;
  value: string;
  description?: string;
  emoji?: GatewayEmoji;
  default?: boolean;
}

export interface GatewaySticker {
  id: string;
  pack_id?: string;
  name: string;
  description?: string;
  tags: string;
  asset?: string;
  type: number;
  format_type: number;
  available?: boolean;
  guild_id?: string;
  user?: GatewayUser;
  sort_value?: number;
}

// Gateway Opcodes
export enum GatewayOpcode {
  Dispatch = 0,
  Heartbeat = 1,
  Identify = 2,
  PresenceUpdate = 3,
  VoiceStateUpdate = 4,
  Resume = 6,
  Reconnect = 7,
  RequestGuildMembers = 8,
  InvalidSession = 9,
  Hello = 10,
  HeartbeatACK = 11,
}

// Gateway Close Codes
export enum GatewayCloseCode {
  UnknownError = 4000,
  UnknownOpcode = 4001,
  DecodeError = 4002,
  NotAuthenticated = 4003,
  AuthenticationFailed = 4004,
  AlreadyAuthenticated = 4005,
  InvalidSeq = 4007,
  RateLimited = 4008,
  SessionTimedOut = 4009,
  InvalidShard = 4010,
  ShardingRequired = 4011,
  InvalidAPIVersion = 4012,
  InvalidIntents = 4013,
  DisallowedIntents = 4014,
}

// Gateway Intents
export enum GatewayIntent {
  Guilds = 1 << 0,
  GuildMembers = 1 << 1,
  GuildBans = 1 << 2,
  GuildEmojisAndStickers = 1 << 3,
  GuildIntegrations = 1 << 4,
  GuildWebhooks = 1 << 5,
  GuildInvites = 1 << 6,
  GuildVoiceStates = 1 << 7,
  GuildPresences = 1 << 8,
  GuildMessages = 1 << 9,
  GuildMessageReactions = 1 << 10,
  GuildMessageTyping = 1 << 11,
  DirectMessages = 1 << 12,
  DirectMessageReactions = 1 << 13,
  DirectMessageTyping = 1 << 14,
  MessageContent = 1 << 15,
  GuildScheduledEvents = 1 << 16,
  AutoModerationConfiguration = 1 << 20,
  AutoModerationExecution = 1 << 21,
}

// Discord API Response Types
export interface DiscordInteraction {
  id: string;
  application_id: string;
  type: number;
  data?: DiscordInteractionData;
  guild_id?: string;
  channel_id?: string;
  member?: GatewayMember;
  user?: GatewayUser;
  token: string;
  version: number;
  message?: GatewayMessage;
  app_permissions?: string;
  locale?: string;
  guild_locale?: string;
}

export interface DiscordInteractionData {
  id?: string;
  name?: string;
  type?: number;
  resolved?: DiscordResolvedData;
  options?: DiscordInteractionDataOption[];
  custom_id?: string;
  component_type?: number;
  values?: string[];
  target_id?: string;
}

export interface DiscordResolvedData {
  users?: Record<string, GatewayUser>;
  members?: Record<string, GatewayMember>;
  roles?: Record<string, GatewayRole>;
  channels?: Record<string, GatewayChannel>;
  messages?: Record<string, GatewayMessage>;
}

export interface DiscordInteractionDataOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: DiscordInteractionDataOption[];
  focused?: boolean;
}

export interface GatewayRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  icon?: string;
  unicode_emoji?: string;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
  tags?: GatewayRoleTags;
  flags: number;
}

export interface GatewayRoleTags {
  bot_id?: string;
  integration_id?: string;
  premium_subscriber?: null;
  subscription_listing_id?: string;
  available_for_purchase?: null;
  guild_connections?: null;
}
```

**Step 2: 创建环境变量类型定义**

```typescript
// src/types/env.ts
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
}
```

**Step 3: 运行类型检查**

Run: `npm run typecheck`
Expected: 无错误

**Step 4: Commit**

```bash
git add src/types/
git commit -m "feat: 添加 Discord 和环境变量类型定义"
```

---

## Task 3: 实现工具函数

**Files:**
- Create: `src/utils/logger.ts`
- Create: `src/utils/env.ts`

**Step 1: 创建日志工具**

```typescript
// src/utils/logger.ts
// 统一日志工具

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: any;
  error?: Error;
}

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  private formatEntry(level: LogLevel, message: string, data?: any, error?: Error): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    };
  }

  private log(level: LogLevel, message: string, data?: any, error?: Error): void {
    const entry = this.formatEntry(level, message, data, error);
    const logMessage = `[${this.context}] ${message}`;
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, entry);
        break;
      case LogLevel.INFO:
        console.info(logMessage, entry);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, entry);
        break;
      case LogLevel.ERROR:
        console.error(logMessage, entry);
        break;
    }
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, error?: Error, data?: any): void {
    this.log(LogLevel.ERROR, message, data, error);
  }
}

// 创建日志实例的工厂函数
export function createLogger(context: string): Logger {
  return new Logger(context);
}
```

**Step 2: 创建环境变量工具**

```typescript
// src/utils/env.ts
// 环境变量访问工具

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
```

**Step 3: 运行类型检查**

Run: `npm run typecheck`
Expected: 无错误

**Step 4: Commit**

```bash
git add src/utils/
git commit -m "feat: 添加日志和环境变量工具"
```

---

## Task 4: 实现 Discord API 封装

**Files:**
- Create: `src/services/discord.ts`

**Step 1: 创建 Discord API 服务**

```typescript
// src/services/discord.ts
// Discord API 封装

import { Env } from '../types/env';
import { GatewayPayload, GatewayOpcode } from '../types/discord';
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

// 导入 GatewayIntent
import { GatewayIntent } from '../types/discord';
```

**Step 2: 运行类型检查**

Run: `npm run typecheck`
Expected: 无错误

**Step 3: Commit**

```bash
git add src/services/discord.ts
git commit -m "feat: 添加 Discord API 封装"
```

---

## Task 5: 实现消息转发服务

**Files:**
- Create: `src/services/forwarder.ts`

**Step 1: 创建消息转发服务**

```typescript
// src/services/forwarder.ts
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
```

**Step 2: 运行类型检查**

Run: `npm run typecheck`
Expected: 无错误

**Step 3: Commit**

```bash
git add src/services/forwarder.ts
git commit -m "feat: 添加消息转发服务"
```

---

## Task 6: 实现 GatewayManager Durable Objects

**Files:**
- Create: `src/gateway.ts`

**Step 1: 创建 GatewayManager**

```typescript
// src/gateway.ts
// Discord Gateway 管理器 (Durable Objects)

import { Env, GatewayState } from './types/env';
import {
  GatewayPayload,
  GatewayOpcode,
  GatewayCloseCode,
  GatewayMessage,
} from './types/discord';
import { DiscordService } from './services/discord';
import { MessageForwarder, createForwarder } from './services/forwarder';
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
    };
  }

  // 处理 HTTP 请求
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/connect') {
      await this.connect();
      return new Response('Connecting to Discord Gateway...');
    }
    
    if (url.pathname === '/status') {
      return new Response(JSON.stringify(this.gatewayState), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    return new Response('GatewayManager is running');
  }

  // 连接到 Discord Gateway
  async connect(): Promise<void> {
    if (this.ws) {
      logger.info('Already connected, closing existing connection');
      this.close();
    }

    try {
      const gatewayUrl = this.discord.getGatewayUrl();
      logger.info('Connecting to Discord Gateway', { url: gatewayUrl });

      // 创建 WebSocket 连接
      const { 0: clientWs, 1: serverWs } = new WebSocketPair();
      this.ws = serverWs;

      // 接受 WebSocket 连接
      serverWs.accept();

      // 设置事件处理器
      this.setupWebSocketHandlers(serverWs);

      // 连接到 Discord Gateway
      const discordWs = new WebSocket(gatewayUrl);
      this.setupDiscordHandlers(discordWs);

      logger.info('WebSocket connection established');
    } catch (error) {
      logger.error('Failed to connect to Discord Gateway', error as Error);
      this.scheduleReconnect();
    }
  }

  // 设置 WebSocket 事件处理器
  private setupWebSocketHandlers(ws: WebSocket): void {
    ws.addEventListener('message', (event) => {
      logger.debug('Received message from client', { data: event.data });
    });

    ws.addEventListener('close', (event) => {
      logger.info('Client WebSocket closed', {
        code: event.code,
        reason: event.reason,
      });
      this.close();
    });

    ws.addEventListener('error', (event) => {
      logger.error('Client WebSocket error', event as any);
    });
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
      this.gatewayState.connected = false;
      this.stopHeartbeat();

      // 检查是否需要重连
      if (event.code !== GatewayCloseCode.DisallowedIntents) {
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
        logger.warn('Invalid session, will reconnect');
        this.gatewayState.sessionId = null;
        this.gatewayState.sequence = null;
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
        logger.info('Connected to Discord', {
          sessionId: data.session_id,
          user: data.user?.username,
        });
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

    logger.info('Scheduling reconnect', { delay });

    this.reconnectTimeout = setTimeout(() => {
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
  }
}

// 导出 Durable Object 类
export default GatewayManager;
```

**Step 2: 运行类型检查**

Run: `npm run typecheck`
Expected: 无错误

**Step 3: Commit**

```bash
git add src/gateway.ts
git commit -m "feat: 添加 GatewayManager Durable Objects"
```

---

## Task 7: 实现 Workers 主入口

**Files:**
- Create: `src/index.ts`
- Create: `src/handlers/interaction.ts`
- Create: `src/handlers/message.ts`

**Step 1: 创建 Interaction 处理器**

```typescript
// src/handlers/interaction.ts
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
```

**Step 2: 创建 Message 处理器**

```typescript
// src/handlers/message.ts
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
```

**Step 3: 创建 Workers 主入口**

```typescript
// src/index.ts
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
      logger.info('Gateway connection initiated');
    } catch (error) {
      logger.error('Failed to initiate gateway connection', error as Error);
    }
  },
};
```

**Step 4: 运行类型检查**

Run: `npm run typecheck`
Expected: 无错误

**Step 5: Commit**

```bash
git add src/index.ts src/handlers/
git commit -m "feat: 添加 Workers 主入口和处理器"
```

---

## Task 8: 配置本地开发环境

**Files:**
- Create: `.dev.vars`
- Modify: `wrangler.toml`

**Step 1: 创建 .dev.vars 文件**

```
DISCORD_TOKEN=your_discord_bot_token_here
DISCORD_PUBLIC_KEY=your_discord_public_key_here
```

**Step 2: 更新 wrangler.toml 添加定时触发器**

```toml
[triggers]
crons = ["0 */6 * * *"]
```

**Step 3: 运行本地开发服务器**

Run: `npm run dev`
Expected: 开发服务器启动成功

**Step 4: Commit**

```bash
git add .dev.vars wrangler.toml
git commit -m "feat: 配置本地开发环境"
```

---

## Task 9: 测试和验证

**Step 1: 类型检查**

Run: `npm run typecheck`
Expected: 无错误

**Step 2: 本地测试**

Run: `npm run dev`
Expected: 开发服务器启动，可以访问 /health 端点

**Step 3: 部署测试**

Run: `npm run deploy`
Expected: 部署成功

**Step 4: 验证功能**

1. 访问 https://your-worker.workers.dev/health 确认服务运行
2. 在 Discord Developer Portal 配置 Interactions Endpoint URL
3. 邀请 Bot 到服务器
4. 发送测试消息验证转发功能

**Step 5: Final Commit**

```bash
git add .
git commit -m "feat: 完成 Discord 消息转发器实现"
```

---

## 完成

实现计划完成！现在可以开始执行了。