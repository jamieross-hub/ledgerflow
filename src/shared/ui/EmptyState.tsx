import { cn } from '../lib/cn';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: string;
  className?: string;
}

export function EmptyState({ title, description, icon = '📭', className }: EmptyStateProps) {
  return (
    <div className={cn('empty-state', className)}>
      <div className="empty-state-icon">{icon}</div>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
    </div>
  );
}
