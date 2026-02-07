import { cn } from '../lib/cn';

interface LoadingSkeletonProps {
  lines?: number;
  card?: boolean;
  className?: string;
}

export function LoadingSkeleton({ lines = 3, card = false, className }: LoadingSkeletonProps) {
  if (card) {
    return <div className={cn('skeleton skeleton-card', className)} aria-hidden="true" />;
  }

  return (
    <div className={cn(className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <div key={index} className="skeleton skeleton-line" />
      ))}
    </div>
  );
}
