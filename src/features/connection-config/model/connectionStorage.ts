import { ConnectionConfig } from '../../../entities/connection/types';
import { ConnectionFormValues } from './connectionFormSchema';
import { generateId } from '../../../shared/lib/id';

const STORAGE_KEY = 'ledgerflow-connections';

function readAll(): ConnectionConfig[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ConnectionConfig[];
  } catch {
    return [];
  }
}

function writeAll(rows: ConnectionConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
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
