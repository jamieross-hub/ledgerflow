import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { ConnectionTestResult } from '../../../entities/connection/types';
import { AppMode } from '../../../shared/types/app';
import { ConnectionFormValues } from '../model/connectionFormSchema';
import { testConnection } from '../model/connectionTest';

interface ConnectionTestButtonProps {
  values: ConnectionFormValues;
  mode: AppMode;
}

export function ConnectionTestButton({ values, mode }: ConnectionTestButtonProps) {
  const [expanded, setExpanded] = useState(false);
  const mutation = useMutation<ConnectionTestResult, Error>({
    mutationFn: () => testConnection(values, mode)
  });

  return (
    <div>
      <button onClick={() => mutation.mutate()} disabled={mutation.isPending} type="button">
        {mutation.isPending ? '测试中...' : '测试连接'}
      </button>

      {mutation.isSuccess && (
        <p style={{ color: mutation.data.ok ? 'green' : '#dc2626' }}>
          {mutation.data.message}（耗时 {mutation.data.elapsedMs}ms）
        </p>
      )}

      {mutation.isError && <p className="error">{mutation.error.message}</p>}

      {(mutation.isSuccess || mutation.isError) && (
        <div>
          <button type="button" onClick={() => setExpanded((x) => !x)}>
            {expanded ? '收起日志' : '展开日志'}
          </button>
          {expanded && (
            <pre className="panel">
              {mutation.isSuccess ? mutation.data.detail : String(mutation.error?.stack || mutation.error)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
