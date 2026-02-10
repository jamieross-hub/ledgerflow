const APP_VERSION = '0.1';

export function AboutPage() {
  return (
    <section className="panel">
      <h2>关于 LedgerFlow</h2>
      <p>
        <strong>当前版本：</strong> v{APP_VERSION}
      </p>
      <p>
        LedgerFlow 的起点，不是“做一个记账页面”，而是想解决一个很真实的问题：
        很多人知道要记账，却总在忙碌里被打断，最后只剩“钱花哪了”的焦虑。
      </p>
      <p>
        这个项目希望把记账从“意志力工程”变成“低摩擦习惯”：
        录入要快、检索要清楚、复盘要有反馈，哪怕只花 30 秒，也能把今天的财务轨迹留下来。
      </p>
      <p>
        故事从一个很普通的夜晚开始：地铁上，手机里同时弹出外卖、打车、订阅扣费通知。
        当时我们发现，真正让人不安的不是花钱，而是“不确定”——
        不知道本月还有多少弹性，不知道哪类支出正在悄悄失控。
      </p>
      <p>
        于是 LedgerFlow 被设计成一条清晰的流水线： 从导入账单、快速筛选，到右键编辑、分类复盘，再到
        AI 辅助总结。 目标很朴素：让每一笔钱都有去处，每一次选择都有依据。
      </p>
      <p>
        同时我们坚持一条工程底线：前端体验可以轻，数据安全不能轻。 浏览器环境不适合直接安全访问
        PostgreSQL / MySQL / Redis，核心原因如下：
      </p>
      <ol style={{ lineHeight: 'var(--leading-relaxed)', color: 'var(--color-text-secondary)' }}>
        <li>数据库凭证会暴露在前端代码和网络请求中，无法真正保密。</li>
        <li>数据库通常位于内网，不应暴露公网端口给浏览器。</li>
        <li>缺少后端鉴权、审计、限流，会带来极高安全风险。</li>
      </ol>
      <p>
        推荐做法：前端通过受控 API
        网关/后端代理访问数据库。当前应用提供“代理模式”接口规范，方便后续无缝接入后端。
      </p>
      <pre
        style={{
          background: 'var(--color-bg-subtle)',
          border: '1px solid var(--color-border-light)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-4)',
          fontFamily: 'var(--font-mono)',
          fontSize: 'var(--font-sm)',
          lineHeight: 'var(--leading-relaxed)',
          overflowX: 'auto',
          color: 'var(--color-text-secondary)'
        }}
      >
        {`POST /api/conn/test
POST /api/conn/save
GET  /api/conn/list
DELETE /api/conn/:id`}
      </pre>
    </section>
  );
}
