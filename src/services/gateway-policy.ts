import { GatewayCloseCode } from '../types/discord';

const BASE_RECONNECT_DELAY = 5000;
const MAX_RECONNECT_DELAY = 60000;
const MAX_RECONNECT_ATTEMPTS = 10;

const FATAL_CLOSE_CODES = new Set<number>([
  GatewayCloseCode.AuthenticationFailed,
  GatewayCloseCode.InvalidShard,
  GatewayCloseCode.ShardingRequired,
  GatewayCloseCode.InvalidAPIVersion,
  GatewayCloseCode.InvalidIntents,
  GatewayCloseCode.DisallowedIntents,
]);

const SESSION_RESET_CLOSE_CODES = new Set<number>([
  GatewayCloseCode.NotAuthenticated,
  GatewayCloseCode.AuthenticationFailed,
  GatewayCloseCode.InvalidSeq,
  GatewayCloseCode.SessionTimedOut,
]);

// Discord 对 1000/1001/1005 等非 Gateway close code 通常允许重新建连。
export function shouldReconnect(closeCode: number): boolean {
  return !FATAL_CLOSE_CODES.has(closeCode);
}

// 这些 close code 代表旧 session 不能安全 resume，下一次必须重新 Identify。
export function shouldResetSession(closeCode: number): boolean {
  return SESSION_RESET_CLOSE_CODES.has(closeCode);
}

// Discord INVALID_SESSION 的 d=false 表示不可恢复，必须重新 Identify。
export function canResumeInvalidSession(payloadData: unknown): boolean {
  return payloadData === true;
}

// 使用完整抖动退避，避免多个实例同时重新 Identify。
export function getReconnectDelay(attempts: number): number {
  const cappedAttempts = Math.min(attempts, MAX_RECONNECT_ATTEMPTS);
  const maxDelay = Math.min(
    BASE_RECONNECT_DELAY * Math.pow(2, cappedAttempts),
    MAX_RECONNECT_DELAY
  );

  return Math.floor(BASE_RECONNECT_DELAY + Math.random() * (maxDelay - BASE_RECONNECT_DELAY));
}
