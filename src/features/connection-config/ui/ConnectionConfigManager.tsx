import { useMemo, useState } from 'react';
import { ConnectionConfigForm } from './ConnectionConfigForm';
import {
  deleteConnection,
  listConnections,
  saveConnection,
  toggleConnection
} from '../model/connectionStorage';
import { ConnectionConfigCard } from './ConnectionConfigCard';
import { AppMode } from '../../../shared/types/app';
import { ConnectionFormValues } from '../model/connectionFormSchema';

interface ConnectionConfigManagerProps {
  mode: AppMode;
}

export function ConnectionConfigManager({ mode }: ConnectionConfigManagerProps) {
  const [version, setVersion] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => listConnections(), [version]);

  function refresh() {
    setVersion((v) => v + 1);
  }

  function handleSave(values: ConnectionFormValues) {
    saveConnection(values);
    setAdding(false);
    setEditingId(null);
    refresh();
  }

  return (
    <section className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3>连接配置管理（PG / MySQL / Redis）</h3>
        <button className="primary" onClick={() => setAdding((x) => !x)}>
          {adding ? '收起新增' : '新增连接'}
        </button>
      </div>

      {adding && <ConnectionConfigForm mode={mode} onSubmit={handleSave} onCancel={() => setAdding(false)} />}

      <div>
        {rows.length === 0 && <p>暂无连接配置，请新增一条。</p>}
        {rows.map((item) => (
          <ConnectionConfigCard
            key={item.id}
            item={item}
            mode={mode}
            editing={editingId === item.id}
            onEdit={() => setEditingId(item.id)}
            onCancelEdit={() => setEditingId(null)}
            onDelete={() => {
              deleteConnection(item.id);
              refresh();
            }}
            onToggle={(enabled) => {
              toggleConnection(item.id, enabled);
              refresh();
            }}
            onSave={handleSave}
          />
        ))}
      </div>
    </section>
  );
}
