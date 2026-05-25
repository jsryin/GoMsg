# GoMsg

GoMsg 是一个运行在 Cloudflare Workers 上的 Discord 消息转发服务。它通过 Discord Gateway 接收服务器消息，并将原始消息 JSON 转发到配置的目标 API。

## 关键功能

- 接入 Discord Gateway，监听 `MESSAGE_CREATE` 事件。
- 使用 Durable Objects 管理 Gateway 连接、状态持久化、心跳和重连。
- 将 Discord 消息通过 `POST` 转发到 `TARGET_API_URL`。
- 提供 Discord Interactions 回调入口，并校验 Discord 签名。
- 提供健康检查和 Gateway 状态查询接口。
- 使用 Durable Object Alarm 处理断线重连，Cron 定时触发作为外部兜底。

## 接口

- `POST /interactions`：Discord Interactions 回调地址。
- `GET /connect`：触发 Discord Gateway 连接。
- `GET /status`：查询 Gateway 连接状态。
- `GET /health`：健康检查。

## Gateway 连接机制

Gateway 连接由 `GatewayManager` Durable Object 维护：

- `sessionId`、`sequence` 和连接状态会写入 Durable Object storage。
- 断线后通过 Durable Object `alarm()` 自动重连，并使用带 jitter 的指数退避。
- 心跳间隔使用 Discord `Hello` 返回的 `heartbeat_interval`，如果心跳 ACK 超时会主动重连。
- 遇到认证失败、无效 Intents 等 fatal close code 时不会无限重连，需要检查配置。

Cron 配置在 `wrangler.toml` 中，当前为每 6 小时触发一次，只作为外部兜底调用 `/connect`。

## 状态排查

访问 `GET /status` 可以查看 Gateway 当前状态。重点关注 `status`、`connected`、`lastCloseCode`、`reconnectAttempts` 和 `nextReconnectAt`。

## 环境变量

`wrangler.toml` 中已配置普通变量：

- `DISCORD_APPLICATION_ID`
- `TARGET_API_URL`

敏感变量建议使用 Wrangler Secret 配置：

```bash
pnpm wrangler secret put DISCORD_TOKEN
pnpm wrangler secret put DISCORD_PUBLIC_KEY
```

## 常用命令

安装依赖：

```bash
pnpm install
```

本地开发：

```bash
pnpm dev
```

类型检查：

```bash
pnpm typecheck
```

部署到 Cloudflare Workers：

```bash
pnpm deploy
```

## Discord 配置要点

- Bot 需要开启 `Guilds`、`Guild Messages`、`Message Content` 相关权限。
- Discord Developer Portal 中的 Interactions Endpoint URL 指向部署后的 `/interactions`。
- 目标 API 需要能接收 `Content-Type: application/json` 的 `POST` 请求。
