interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

export function TableSkeleton({ rows = 6, columns = 6 }: TableSkeletonProps) {
  return (
    <div className="table-skeleton" aria-hidden="true">
      <div className="table-skeleton-head">
        {Array.from({ length: columns }).map((_, index) => (
          <div key={`head-${index}`} className="skeleton table-skeleton-cell" />
        ))}
      </div>
      <div className="table-skeleton-body">
        {Array.from({ length: rows }).map((_, row) => (
          <div key={`row-${row}`} className="table-skeleton-row">
            {Array.from({ length: columns }).map((__, col) => (
              <div key={`cell-${row}-${col}`} className="skeleton table-skeleton-cell" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
