import { ConnectionConfig } from '../../../entities/connection/types';
import { ConnectionFormValues } from './connectionFormSchema';
import { generateId } from '../../../shared/lib/id';

const STORAGE_KEY = 'ledgerflow-connections';
const STORAGE_VERSION = 3;
const SECRET_FIELDS: Array<keyof ConnectionConfig> = ['password', 'connectionString'];
const SECRET_SESSION_KEY = 'ledgerflow-connections-secrets';

interface PersistedPayload {
  v: number;
  rows: ConnectionConfig[];
}

type SecretFields = Pick<ConnectionConfig, 'password' | 'connectionString'>;

function readSessionSecrets(): Record<string, SecretFields> {
  try {
    const raw = window.sessionStorage.getItem(SECRET_SESSION_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, SecretFields>;
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed;
  } catch {
    return {};
  }
}

function writeSessionSecrets(secrets: Record<string, SecretFields>) {
  try {
    if (Object.keys(secrets).length === 0) {
      window.sessionStorage.removeItem(SECRET_SESSION_KEY);
      return;
    }
    window.sessionStorage.setItem(SECRET_SESSION_KEY, JSON.stringify(secrets));
  } catch {
    // ignore storage errors
  }
}

function storeRowSecrets(row: ConnectionConfig) {
  const current = readSessionSecrets();
  current[row.id] = {
    password: row.password || '',
    connectionString: row.connectionString || ''
  };
  writeSessionSecrets(current);
}

function removeRowSecrets(id: string) {
  const current = readSessionSecrets();
  if (!current[id]) return;
  delete current[id];
  writeSessionSecrets(current);
}

function attachRowSecrets(row: ConnectionConfig): ConnectionConfig {
  const secret = readSessionSecrets()[row.id];
  if (!secret) return row;
  return {
    ...row,
    password: secret.password || row.password,
    connectionString: secret.connectionString || row.connectionString
  };
}

function stripRowSecrets(row: ConnectionConfig): ConnectionConfig {
  const next = { ...row };
  SECRET_FIELDS.forEach((field) => {
    next[field] = '' as never;
  });
  return next;
}

function readAll(): ConnectionConfig[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as ConnectionConfig[] | PersistedPayload;

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed && Array.isArray(parsed.rows)) {
      return parsed.rows.map((item) => attachRowSecrets(item));
    }

    return [];
  } catch {
    return [];
  }
}

function writeAll(rows: ConnectionConfig[]) {
  const payload: PersistedPayload = {
    v: STORAGE_VERSION,
    rows: rows.map((item) => stripRowSecrets(item))
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function listConnections() {
  return readAll();
}

export function saveConnection(values: ConnectionFormValues) {
  const rows = readAll();
  const now = new Date().toISOString();
  const next: ConnectionConfig = {
    ...values,
    id: values.id ?? generateId(),
    createdAt: values.id ? (rows.find((x) => x.id === values.id)?.createdAt ?? now) : now,
    updatedAt: now
  };

  storeRowSecrets(next);

  const idx = rows.findIndex((x) => x.id === next.id);
  if (idx >= 0) rows[idx] = next;
  else rows.unshift(next);

  writeAll(rows);
  return next;
}

export function deleteConnection(id: string) {
  writeAll(readAll().filter((x) => x.id !== id));
  removeRowSecrets(id);
}

export function toggleConnection(id: string, enabled: boolean) {
  const rows = readAll().map((x) =>
    x.id === id ? { ...x, enabled, updatedAt: new Date().toISOString() } : x
  );
  writeAll(rows);
}
