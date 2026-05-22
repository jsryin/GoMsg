# Discord 消息转发器设计文档

## 项目概述

部署在 Cloudflare Workers 上的 Discord 机器人，用于监听所有频道的用户消息，打印日志，并将完整消息对象通过 POST 转发到指定接口。

## 技术选型

- **运行时**: Cloudflare Workers
- **WebSocket 管理**: Cloudflare Durable Objects
- **语言**: TypeScript
- **Discord API 版本**: v10

## 架构设计

### 整体架构

```
用户消息 → Discord Gateway → Durable Objects (WebSocket) → Workers (处理) → 目标 API
```

1. **Durable Objects**: 维持与 Discord Gateway 的 WebSocket 连接，接收实时事件
2. **Workers**: 处理消息事件，打印日志，转发到目标 API
3. **环境变量**: 存储配置信息（Token、API 地址等）

### 核心组件

#### 1. GatewayManager (Durable Objects)
- 维持 Discord Gateway WebSocket 连接
- 处理心跳、重连、序列号管理
- 接收事件并转发给 Workers 处理

#### 2. MessageProcessor (Workers)
- 接收消息事件
- 打印日志（包含消息内容、作者、频道等信息）
- 将完整消息对象 POST 到目标 API
- 错误处理（仅记录日志，不重试）

#### 3. InteractionHandler (Workers)
- 处理 Discord Interactions 端点验证
- 响应 Discord 的 PING 验证请求

## 环境变量配置

```
DISCORD_TOKEN=<Bot Token>
DISCORD_PUBLIC_KEY=<Application Public Key>
DISCORD_APPLICATION_ID=<Application ID>
TARGET_API_URL=<目标 API 地址>
```

## 数据流

1. Discord Gateway 推送 MESSAGE_CREATE 事件
2. Durable Objects 接收事件并解析
3. 调用 Workers 的消息处理逻辑
4. Workers 打印日志并转发到目标 API
5. 目标 API 返回响应（Workers 仅记录成功/失败）

## 错误处理

- WebSocket 断开：自动重连（指数退避）
- 转发失败：记录错误日志，不重试
- 验证失败：返回 401 响应

## 限制与约束

- Cloudflare Workers 免费版有请求限制
- Durable Objects 有额外成本
- 不支持斜杠命令等交互（仅消息监听）
- 消息转发为异步操作，不保证顺序

## 部署步骤

1. 创建 Cloudflare Worker
2. 配置 Durable Objects
3. 设置环境变量
4. 部署并配置 Discord Interactions Endpoint URL
5. 在 Discord Developer Portal 订阅 MESSAGE_CREATE 事件

## 文件结构

```
GoMsg/
├── src/
│   ├── index.ts                 # Workers 主入口
│   ├── gateway.ts               # Durable Objects (GatewayManager)
│   ├── handlers/
│   │   ├── message.ts           # 消息处理逻辑
│   │   └── interaction.ts       # Interactions 处理
│   ├── services/
│   │   ├── discord.ts           # Discord API 封装
│   │   └── forwarder.ts         # 消息转发服务
│   ├── types/
│   │   └── discord.ts           # Discord 类型定义
│   └── utils/
│       ├── logger.ts            # 日志工具
│       └── env.ts               # 环境变量工具
├── wrangler.toml                # Cloudflare Workers 配置
├── tsconfig.json                # TypeScript 配置
├── package.json                 # 项目依赖
└── .dev.vars                    # 本地开发环境变量
```

## 核心流程

### 启动流程
```
Workers 启动 → 检查 Durable Objects 是否存在 → 创建/获取 GatewayManager → 建立 WebSocket 连接
```

### 消息处理流程
```
Discord Gateway 推送事件 → Durable Objects 接收 → 解析事件类型
  ├── MESSAGE_CREATE → 调用 message handler → 打印日志 → POST 到目标 API
  └── 其他事件 → 忽略
```

### 重连机制
```
WebSocket 断开 → 等待（指数退避）→ 重新连接 → 恢复事件监听
```

### 错误处理流程
```
转发失败 → 记录错误日志（包含消息ID、错误信息）→ 继续处理下一个消息
```

### 日志格式
```json
{
  "timestamp": "2026-05-22T10:00:00Z",
  "level": "info",
  "event": "message_received",
  "data": {
    "message_id": "123456789",
    "author": "user#1234",
    "channel_id": "987654321",
    "content": "消息内容"
  }
}
```

## Discord 配置要求

### 1. Discord Developer Portal 设置
- 创建 Application
- 获取 **Application ID**、**Public Key**、**Bot Token**
- 在 Bot 页面开启 **Message Content Intent**

### 2. Bot 权限
```
- Read Messages/View Channels
- Read Message History
```

### 3. 事件订阅
在 **Interactions Endpoint URL** 中配置 Workers 地址：
```
https://your-worker.your-subdomain.workers.dev/interactions
```

订阅事件：
- `MESSAGE_CREATE` - 新消息创建

### 4. 邀请链接
使用 OAuth2 URL Generator 生成邀请链接，权限选择：
- `Read Messages/View Channels`
- `Read Message History`

### 5. 注意事项
- Bot 必须是服务器成员才能接收消息
- Message Content Intent 必须开启，否则无法读取消息内容
- Public Key 用于验证 Discord 请求签名

## 实现细节

### 1. GatewayManager (Durable Objects)
```typescript
// 核心功能
- connect(): 建立 WebSocket 连接
- heartbeat(): 定时发送心跳
- handleMessage(): 处理接收到的消息
- reconnect(): 断线重连（指数退避）
- identify(): 发送 IDENTIFY 包
```

### 2. MessageProcessor
```typescript
// 核心功能
- processMessage(event): 处理消息事件
- logMessage(message): 打印日志
- forwardMessage(message): POST 到目标 API
```

### 3. 环境变量访问
```typescript
// 通过 env 对象访问，支持类型检查
interface Env {
  DISCORD_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
  TARGET_API_URL: string;
  GATEWAY_MANAGER: DurableObjectNamespace;
}
```

### 4. 错误处理策略
- WebSocket 错误：记录日志，自动重连
- 转发错误：记录日志，继续处理
- 验证错误：返回 401

### 5. 性能考虑
- 异步转发，不阻塞消息接收
- 批量处理（可选优化）
- 日志采样（高流量时可选）