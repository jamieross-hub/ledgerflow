const APP_VERSION = '0.1';

export function AboutPage() {
  return (
    <section className="panel">
      <h2>关于 LedgerFlow</h2>
      <p>
        <strong>当前版本：</strong> v{APP_VERSION}
      </p>
      <p>
        LedgerFlow 是一个现代化记账前端模板，聚焦"可维护架构 + 可部署工程化 + 可扩展 AI 辅助记账"。
      </p>
      <p>
        本项目是纯前端记账软件演示。浏览器环境不适合直接安全访问 PostgreSQL / MySQL / Redis，核心原因如下：
      </p>
      <ol style={{ lineHeight: 'var(--leading-relaxed)', color: 'var(--color-text-secondary)' }}>
        <li>数据库凭证会暴露在前端代码和网络请求中，无法真正保密。</li>
        <li>数据库通常位于内网，不应暴露公网端口给浏览器。</li>
        <li>缺少后端鉴权、审计、限流，会带来极高安全风险。</li>
      </ol>
      <p>
        推荐做法：前端通过受控 API 网关/后端代理访问数据库。当前应用提供"代理模式"接口规范，方便后续无缝接入后端。
      </p>
      <pre style={{
        background: 'var(--color-bg-subtle)',
        border: '1px solid var(--color-border-light)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-4)',
        fontFamily: 'var(--font-mono)',
        fontSize: 'var(--font-sm)',
        lineHeight: 'var(--leading-relaxed)',
        overflowX: 'auto',
        color: 'var(--color-text-secondary)'
      }}>
{`POST /api/conn/test
POST /api/conn/save
GET  /api/conn/list
DELETE /api/conn/:id`}
      </pre>
    </section>
  );
}
