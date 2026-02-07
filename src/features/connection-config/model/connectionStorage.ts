import { ConnectionConfig } from '../../../entities/connection/types';
import { ConnectionFormValues } from './connectionFormSchema';
import { generateId } from '../../../shared/lib/id';

const STORAGE_KEY = 'ledgerflow-connections';
const STORAGE_VERSION = 2;
const SECRET_FIELDS: Array<keyof ConnectionConfig> = ['password', 'connectionString'];

interface PersistedPayload {
  v: number;
  rows: ConnectionConfig[];
}

function getLocalCipherKey() {
  return `${window.location.origin}|${navigator.userAgent}|${STORAGE_KEY}|v${STORAGE_VERSION}`;
}

function toBase64(input: string) {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function fromBase64(input: string) {
  const binary = atob(input);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function xorTransform(value: string, key: string) {
  if (!value) return value;
  const chars = Array.from(value).map((char, idx) =>
    String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(idx % key.length))
  );
  return chars.join('');
}

function encryptText(value?: string) {
  if (!value) return value;
  const transformed = xorTransform(value, getLocalCipherKey());
  return toBase64(transformed);
}

function decryptText(value?: string) {
  if (!value) return value;
  try {
    const raw = fromBase64(value);
    return xorTransform(raw, getLocalCipherKey());
  } catch {
    return value;
  }
}

function encryptRow(row: ConnectionConfig): ConnectionConfig {
  const next = { ...row };
  SECRET_FIELDS.forEach((field) => {
    const val = next[field];
    if (typeof val === 'string' && val.trim()) {
      next[field] = encryptText(val) as never;
    }
  });
  return next;
}

function decryptRow(row: ConnectionConfig): ConnectionConfig {
  const next = { ...row };
  SECRET_FIELDS.forEach((field) => {
    const val = next[field];
    if (typeof val === 'string' && val.trim()) {
      next[field] = decryptText(val) as never;
    }
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
      return parsed.rows.map((item) => decryptRow(item));
    }

    return [];
  } catch {
    return [];
  }
}

function writeAll(rows: ConnectionConfig[]) {
  const payload: PersistedPayload = {
    v: STORAGE_VERSION,
    rows: rows.map((item) => encryptRow(item))
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
    createdAt: values.id ? rows.find((x) => x.id === values.id)?.createdAt ?? now : now,
    updatedAt: now
  };

  const idx = rows.findIndex((x) => x.id === next.id);
  if (idx >= 0) rows[idx] = next;
  else rows.unshift(next);

  writeAll(rows);
  return next;
}

export function deleteConnection(id: string) {
  writeAll(readAll().filter((x) => x.id !== id));
}

export function toggleConnection(id: string, enabled: boolean) {
  const rows = readAll().map((x) => (x.id === id ? { ...x, enabled, updatedAt: new Date().toISOString() } : x));
  writeAll(rows);
}
