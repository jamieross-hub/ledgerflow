import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { ConnectionFormValues, connectionFormSchema } from '../model/connectionFormSchema';
import { getConnectionDefaults, getPortByType } from '../model/connectionDefaults';
import { ConnectionTestButton } from './ConnectionTestButton';
import { AppMode } from '../../../shared/types/app';
import { parseConnectionString } from '../model/connectionString';

interface ConnectionConfigFormProps {
  mode: AppMode;
  initialValues?: ConnectionFormValues;
  onSubmit: (values: ConnectionFormValues) => void;
  onCancel?: () => void;
}

export function ConnectionConfigForm({ mode, initialValues, onSubmit, onCancel }: ConnectionConfigFormProps) {
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

  return (
    <form className="panel" onSubmit={form.handleSubmit(onSubmit)}>
      <h3>{initialValues?.id ? '编辑连接配置' : '新增连接配置'}</h3>

      <div className="grid grid-3">
        <div className="field">
          <label>名称</label>
          <input {...form.register('name')} placeholder="生产PG只读" />
          <small className="error">{form.formState.errors.name?.message}</small>
        </div>

        <div className="field">
          <label>类型</label>
          <select
            {...form.register('type')}
            onChange={(e) => {
              const type = e.target.value as ConnectionFormValues['type'];
              form.setValue('type', type);
              form.setValue('port', getPortByType(type));
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
          <label>Host</label>
          <input {...form.register('host')} />
          <small className="error">{form.formState.errors.host?.message}</small>
        </div>
        <div className="field">
          <label>Port</label>
          <input type="number" {...form.register('port')} />
          <small className="error">{form.formState.errors.port?.message}</small>
        </div>
        <div className="field">
          <label>超时（ms）</label>
          <input type="number" {...form.register('timeoutMs')} />
        </div>
      </div>

      {watchType !== 'redis' && (
        <div className="grid grid-3">
          <div className="field">
            <label>用户名</label>
            <input {...form.register('username')} />
            <small className="error">{form.formState.errors.username?.message}</small>
          </div>
          <div className="field">
            <label>密码</label>
            <input type="password" {...form.register('password')} />
          </div>
          <div className="field">
            <label>数据库名</label>
            <input {...form.register('database')} />
            <small className="error">{form.formState.errors.database?.message}</small>
          </div>
        </div>
      )}

      <div className="field">
        <label>连接串（可选，优先级高于离散字段）</label>
        <div className="row">
          <input {...form.register('connectionString')} placeholder="postgres://user:pass@host:5432/db" />
          <button type="button" onClick={applyConnectionString}>
            解析连接串
          </button>
        </div>
        <small className="error">{form.formState.errors.connectionString?.message}</small>
      </div>

      <div className="grid grid-3">
        <div className="field">
          <label>连接池 min</label>
          <input type="number" {...form.register('pool.min')} />
        </div>
        <div className="field">
          <label>连接池 max</label>
          <input type="number" {...form.register('pool.max')} />
        </div>
        <div className="field">
          <label>idleTimeoutMs</label>
          <input type="number" {...form.register('pool.idleTimeoutMs')} />
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

      <div className="row" style={{ marginTop: 12 }}>
        <button className="primary" type="submit">
          保存配置
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            取消
          </button>
        )}
        <ConnectionTestButton values={form.watch()} mode={mode} />
      </div>
    </form>
  );
}
