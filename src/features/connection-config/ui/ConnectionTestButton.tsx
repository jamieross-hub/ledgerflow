import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ConnectionTestResult } from '../../../entities/connection/types';
import { ConnectionFormValues } from '../model/connectionFormSchema';
import { testConnection } from '../model/connectionTest';

interface ConnectionTestButtonProps {
  values: ConnectionFormValues;
  disabled?: boolean;
  onTestingChange?: (testing: boolean) => void;
  onResult?: (result: { ok: boolean; message: string; detail: string; elapsedMs: number }) => void;
}

export function ConnectionTestButton({
  values,
  disabled = false,
  onTestingChange,
  onResult
}: ConnectionTestButtonProps) {
  const [expanded, setExpanded] = useState(false);
  const mutation = useMutation<ConnectionTestResult, Error>({
    mutationFn: () => testConnection(values),
    onSuccess: (data) => {
      onResult?.({
        ok: data.ok,
        message: data.message,
        detail: data.detail,
        elapsedMs: data.elapsedMs
      });
    },
    onError: (error) => {
      onResult?.({
        ok: false,
        message: error.message,
        detail: String(error.stack || error),
        elapsedMs: 0
      });
    }
  });

  useEffect(() => {
    onTestingChange?.(mutation.isPending);
  }, [mutation.isPending, onTestingChange]);

  return (
    <div className="connection-test-wrap">
      <button
        onClick={() => mutation.mutate()}
        disabled={disabled || mutation.isPending}
        type="button"
      >
        {mutation.isPending ? '连接中...' : '测试连接'}
      </button>

      {mutation.isSuccess ? (
        <p className={mutation.data.ok ? 'connection-test-success' : 'connection-test-error'}>
          {mutation.data.message}（耗时 {mutation.data.elapsedMs}ms）
        </p>
      ) : null}

      {mutation.isError ? <p className="connection-test-error">{mutation.error.message}</p> : null}

      {mutation.isSuccess || mutation.isError ? (
        <div>
          <button type="button" onClick={() => setExpanded((value) => !value)}>
            {expanded ? '收起日志' : '展开日志'}
          </button>
          {expanded ? (
            <pre className="connection-test-log">
              {mutation.isSuccess
                ? mutation.data.detail
                : String(mutation.error?.stack || mutation.error)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
