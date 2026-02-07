import { EmptyState } from '../../shared/ui/EmptyState';

export function TagsPage() {
  return (
    <section className="panel">
      <h2>🏷️ 交易标签</h2>
      <EmptyState
        title="标签功能开发中"
        description="交易标签管理功能即将上线，敬请期待。"
        icon="🏷️"
      />
    </section>
  );
}
