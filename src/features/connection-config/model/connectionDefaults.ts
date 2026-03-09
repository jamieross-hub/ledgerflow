import { ConnectionFormValues } from './connectionFormSchema';

const DEFAULT_PORT: Record<ConnectionFormValues['type'], number> = {
  redis: 6379,
  mysql: 3306
};

export function getConnectionDefaults(
  type: ConnectionFormValues['type'] = 'mysql'
): ConnectionFormValues {
  return {
    name: '',
    type,
    host: 'localhost',
    port: DEFAULT_PORT[type],
    username: '',
    password: '',
    database: type === 'redis' ? '0' : 'ledgerflow',
    connectionString: '',
    enabled: true,
    timeoutMs: 8000,
    pool: {
      min: 1,
      max: 10,
      idleTimeoutMs: 10000
    },
    tls: {
      enabled: false,
      rejectUnauthorized: true,
      caCert: ''
    }
  };
}

export function getPortByType(type: ConnectionFormValues['type']) {
  return DEFAULT_PORT[type];
}
