import { ReactNode } from 'react';
import { cn } from '../lib/cn';

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'primary' | 'danger';
}

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
}

function renderAction(action: EmptyStateAction, key: string) {
  const className = action.variant === 'primary' ? 'primary' : action.variant === 'danger' ? 'danger' : undefined;
  return (
    <button key={key} type="button" className={className} onClick={action.onClick}>
      {action.label}
    </button>
  );
}

export function EmptyState({
  title,
  description,
  icon = '📭',
  className,
  primaryAction,
  secondaryAction
}: EmptyStateProps) {
  return (
    <div className={cn('empty-state', className)}>
      <div className="empty-state-icon" aria-hidden="true">
        {icon}
      </div>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {primaryAction || secondaryAction ? (
        <div className="row empty-state-actions" style={{ justifyContent: 'center', marginTop: 12 }}>
          {secondaryAction ? renderAction(secondaryAction, 'secondary') : null}
          {primaryAction ? renderAction(primaryAction, 'primary') : null}
        </div>
      ) : null}
    </div>
  );
}
