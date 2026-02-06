export type ConnectionType = 'postgresql' | 'mysql' | 'redis';

export interface ConnectionPoolConfig {
  min: number;
  max: number;
  idleTimeoutMs: number;
}

export interface ConnectionTlsConfig {
  enabled: boolean;
  rejectUnauthorized: boolean;
  caCert?: string;
}

export interface ConnectionConfig {
  id: string;
  name: string;
  type: ConnectionType;
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: string;
  connectionString?: string;
  enabled: boolean;
  timeoutMs: number;
  pool: ConnectionPoolConfig;
  tls: ConnectionTlsConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  elapsedMs: number;
  detail: string;
}
