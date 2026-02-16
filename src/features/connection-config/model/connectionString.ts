export interface ParsedConnectionString {
  host: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
}

const PROTOCOL_MAP: Record<'redis', string[]> = {
  redis: ['redis', 'rediss']
};

function normalizeProtocol(raw: string) {
  return raw.replace(':', '').toLowerCase();
}

export function parseConnectionString(connectionString: string, type: 'redis') {
  try {
    const url = new URL(connectionString);
    const protocol = normalizeProtocol(url.protocol);

    if (!PROTOCOL_MAP[type].includes(protocol)) {
      return {
        ok: false as const,
        error: `协议不匹配：${type} 连接应使用 ${PROTOCOL_MAP[type].join('/')}://`
      };
    }

    const port = url.port ? Number(url.port) : undefined;
    if (port && (port < 1 || port > 65535)) {
      return { ok: false as const, error: '端口必须在 1-65535' };
    }

    const parsed: ParsedConnectionString = {
      host: url.hostname,
      port,
      username: decodeURIComponent(url.username || ''),
      password: decodeURIComponent(url.password || ''),
      database: url.pathname.replace(/^\//, '') || undefined
    };

    return { ok: true as const, parsed };
  } catch {
    return { ok: false as const, error: '连接串格式不正确，请检查协议、主机、端口和路径' };
  }
}
