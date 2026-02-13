const APP_VERSION = '0.1';

export function AboutPage() {
  return (
    <section className="panel about-page">
      <header className="about-header">
        <h2>关于 LedgerFlow</h2>
        <p>
          <strong>当前版本：</strong> v{APP_VERSION}
        </p>
      </header>

      <section className="about-block">
        <h3>我们为什么做这件事</h3>
        <p>
          LedgerFlow 的起点，不是“做一个记账页面”，而是解决一个真实问题：
          很多人知道要记账，却总在忙碌里被打断，最后只剩“钱花哪了”的焦虑。
        </p>
        <p>
          我们希望把记账从“意志力工程”变成“低摩擦习惯”：
          录入要快、检索要清楚、复盘要有反馈，哪怕只花 30 秒，也能留下今天的财务轨迹。
        </p>
      </section>

      <section className="about-block">
        <h3>产品设计原则</h3>
        <ul>
          <li>每一笔收支都能快速落地。</li>
          <li>每一次回看都能看到趋势和原因。</li>
          <li>每一个建议都尽量可执行。</li>
        </ul>
      </section>

      <section className="about-block">
        <h3>安全与架构说明</h3>
        <p>浏览器不适合直接安全访问 PostgreSQL / MySQL / Redis，核心原因如下：</p>
        <ol>
          <li>数据库凭证会暴露在前端代码和网络请求中，无法真正保密。</li>
          <li>数据库通常位于内网，不应暴露公网端口给浏览器。</li>
          <li>缺少后端鉴权、审计、限流，会带来极高安全风险。</li>
        </ol>
        <p>推荐做法：前端通过受控 API 网关 / 后端代理访问数据库。</p>
      </section>

      <pre className="about-api-pre">
        {`POST /api/conn/test
POST /api/conn/save
GET  /api/conn/list
DELETE /api/conn/:id`}
      </pre>
    </section>
  );
}
