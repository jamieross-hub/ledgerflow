import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useDebugLogStore } from '../../../shared/store/useDebugLogStore';
import { getConnectionDefaults, getPortByType } from '../model/connectionDefaults';
import { ConnectionFormValues, connectionFormSchema } from '../model/connectionFormSchema';
import { parseConnectionString } from '../model/connectionString';
import { ConnectionTestButton } from './ConnectionTestButton';

interface ConnectionConfigFormProps {
  initialValues?: ConnectionFormValues;
  onSubmit: (values: ConnectionFormValues) => void;
  onCancel?: () => void;
}

function getDefaultsByType(type: ConnectionFormValues['type']) {
  return getConnectionDefaults(type);
}

export function ConnectionConfigForm({ initialValues, onSubmit, onCancel }: ConnectionConfigFormProps) {
  const addLog = useDebugLogStore((s) => s.addLog);
  const [testing, setTesting] = useState(false);

  const form = useForm<ConnectionFormValues>({
    resolver: zodResolver(connectionFormSchema),
    defaultValues: initialValues ?? getConnectionDefaults()
  });

  const watchType = form.watch('type');

  function applyConnectionString() {
    const values = form.getValues();
    if (!values.connectionString?.trim()) return;

    const result = parseConnectionString(values.connectionString, values.type);
    if (!result.ok) {
      form.setError('connectionString', { message: result.error });
      return;
    }

    form.clearErrors('connectionString');
    const parsed = result.parsed;
    if (parsed.host) form.setValue('host', parsed.host);
    if (parsed.port) form.setValue('port', parsed.port);
    if (parsed.username) form.setValue('username', parsed.username);
    if (parsed.password) form.setValue('password', parsed.password);
    if (parsed.database) form.setValue('database', parsed.database);
  }

  async function handleSubmit(values: ConnectionFormValues) {
    try {
      await Promise.resolve(onSubmit(values));
      addLog({
        action: '保存配置',
        status: 'success',
        dbType: values.type,
        message: `${values.type.toUpperCase()} 配置已保存`
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : '保存失败';
      addLog({
        action: '保存配置',
        status: 'error',
        dbType: values.type,
        message: msg
      });
      throw error;
    }
  }

  return (
    <form className="panel connection-form" onSubmit={form.handleSubmit(handleSubmit)}>
      <div className="connection-layout">
        <section className="connection-main">
          <header className="connection-section-header">
            <h3>{initialValues?.id ? '编辑连接配置' : '新增连接配置'}</h3>
            <p>数据库连接配置区</p>
          </header>

          <div className="grid grid-3">
            <div className="field">
              <label title="用于区分不同环境连接">名称</label>
              <input {...form.register('name')} placeholder="例如：生产 PG 只读" />
              <small className="error">{form.formState.errors.name?.message}</small>
            </div>

            <div className="field">
              <label title="切换类型后会自动填充端口与默认字段">数据库类型</label>
              <select
                {...form.register('type')}
                onChange={(e) => {
                  const type = e.target.value as ConnectionFormValues['type'];
                  const defaults = getDefaultsByType(type);
                  form.setValue('type', type);
                  form.setValue('port', getPortByType(type));
                  form.setValue('host', defaults.host);
                  form.setValue('database', defaults.database);
                  if (type === 'redis') {
                    form.setValue('username', '');
                  }
                }}
              >
                <option value="postgresql">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="redis">Redis</option>
              </select>
            </div>

            <div className="field">
              <label>启用</label>
              <input type="checkbox" {...form.register('enabled')} />
            </div>
          </div>

          <div className="grid grid-3">
            <div className="field">
              <label title="数据库服务器地址">Host</label>
              <input {...form.register('host')} placeholder="localhost / 10.0.0.5" />
              <small className="error">{form.formState.errors.host?.message}</small>
            </div>
            <div className="field">
              <label title="系统会根据数据库类型自动填充默认端口">Port</label>
              <input type="number" {...form.register('port')} placeholder="5432" />
              <small className="error">{form.formState.errors.port?.message}</small>
            </div>
            <div className="field">
              <label title="连接后默认访问的数据库">数据库名</label>
              <input {...form.register('database')} placeholder={watchType === 'redis' ? '0' : 'ledgerflow'} />
              <small className="error">{form.formState.errors.database?.message}</small>
            </div>
          </div>

          {watchType !== 'redis' && (
            <div className="grid grid-3">
              <div className="field">
                <label title="数据库登录用户名">用户名</label>
                <input {...form.register('username')} placeholder="postgres / root" />
                <small className="error">{form.formState.errors.username?.message}</small>
              </div>
              <div className="field">
                <label title="密码仅用于连接，不以明文存储">密码</label>
                <input type="password" {...form.register('password')} placeholder="请输入密码" />
              </div>
            </div>
          )}

          <div className="field">
            <label title="连接串优先级高于离散字段">连接串（可选）</label>
            <div className="row connection-inline-row">
              <input {...form.register('connectionString')} placeholder="postgres://user:pass@host:5432/db" />
              <button type="button" onClick={applyConnectionString}>
                解析连接串
              </button>
            </div>
            <small className="error">{form.formState.errors.connectionString?.message}</small>
          </div>

          <details className="connection-advanced">
            <summary>高级设置（默认收起）</summary>
            <div className="grid grid-3">
              <div className="field">
                <label title="连接超时时间（毫秒）">超时（ms）</label>
                <input type="number" {...form.register('timeoutMs')} />
              </div>
              <div className="field">
                <label title="连接池最小连接数">连接池 min</label>
                <input type="number" {...form.register('pool.min')} />
              </div>
              <div className="field">
                <label title="连接池最大连接数">连接池 max</label>
                <input type="number" {...form.register('pool.max')} />
              </div>
            </div>

            <div className="grid grid-2">
              <div className="field">
                <label title="空闲连接超时回收">idleTimeoutMs</label>
                <input type="number" {...form.register('pool.idleTimeoutMs')} />
              </div>
              <div className="field">
                <label title="可选 CA 证书">CA 证书</label>
                <input {...form.register('tls.caCert')} placeholder="-----BEGIN CERTIFICATE-----" />
              </div>
            </div>

            <div className="row">
              <label>
                <input type="checkbox" {...form.register('tls.enabled')} /> TLS/SSL
              </label>
              <label>
                <input type="checkbox" {...form.register('tls.rejectUnauthorized')} /> 校验证书
              </label>
            </div>
          </details>
        </section>

        <aside className="connection-actions">
          <header className="connection-section-header">
            <h3>操作区</h3>
            <p>测试连接与保存配置</p>
          </header>

          <ConnectionTestButton
            values={form.watch()}
            disabled={form.formState.isSubmitting}
            onTestingChange={setTesting}
            onResult={(result) => {
              addLog({
                action: '测试连接',
                status: result.ok ? 'success' : 'error',
                dbType: form.getValues('type'),
                message: result.ok ? `${result.message}（${result.elapsedMs}ms）` : result.message
              });
            }}
          />

          <button className="primary" type="submit" disabled={testing || form.formState.isSubmitting}>
            {form.formState.isSubmitting ? '保存中...' : '保存配置'}
          </button>

          {onCancel && (
            <button type="button" onClick={onCancel} disabled={testing || form.formState.isSubmitting}>
              取消
            </button>
          )}
        </aside>
      </div>
    </form>
  );
}
