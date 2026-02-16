import { useState } from 'react';
import { ConnectionConfigForm } from './ConnectionConfigForm';
import {
  deleteConnection,
  listConnections,
  saveConnection,
  toggleConnection
} from '../model/connectionStorage';
import { ConnectionConfigCard } from './ConnectionConfigCard';
import { ConnectionFormValues } from '../model/connectionFormSchema';

export function ConnectionConfigManager() {
  const [, setRefreshTick] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(true);

  // 通过刷新 tick 强制重渲染，从而读取最新连接配置。
  const rows = listConnections();

  function refresh() {
    setRefreshTick((v) => v + 1);
  }

  function handleSave(values: ConnectionFormValues) {
    saveConnection(values);
    setAdding(false);
    setEditingId(null);
    refresh();
  }

  return (
    <section id="connection-config-manager" className="panel">
      <div
        className="row"
        style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}
      >
        <div>
          <h3 style={{ margin: 0 }}>连接配置管理（Redis）</h3>
          <p
            style={{
              margin: '6px 0 0',
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-sm)'
            }}
          >
            支持直接填写地址、端口、用户名、密码、连接串及 TLS
            参数。敏感字段将以加密形式存储到浏览器本地。
          </p>
        </div>
        <button className="primary" onClick={() => setAdding((x) => !x)}>
          {adding ? '收起新增表单' : '展开新增表单'}
        </button>
      </div>

      {adding && <ConnectionConfigForm onSubmit={handleSave} onCancel={() => setAdding(false)} />}

      <div>
        {rows.length === 0 && <p>暂无连接配置，请新增一条。</p>}
        {rows.map((item) => (
          <ConnectionConfigCard
            key={item.id}
            item={item}
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
