import { APP_GITHUB_URL } from '../../shared/config/app';

export function AboutPage() {
  return (
    <section className="panel about-page">
      <header className="about-header">
        <h2>关于 LedgerFlow</h2>
      </header>

      <section className="about-block">
        <h3>项目主页</h3>
        <p>
          GitHub：
          <a href={APP_GITHUB_URL} target="_blank" rel="noreferrer">
            {APP_GITHUB_URL}
          </a>
        </p>
      </section>

      <section className="about-block">
        <h3>我们为什么做这件事</h3>
        <p>
          LedgerFlow 想做的，不只是“把账记下来”，而是让你在忙碌里也能快速掌握钱的去向。
          今天花了什么、哪些消费在悄悄变多、哪里能再省一点，应该是随手可得的信息。
        </p>
        <p>
          我们希望把记账从“必须坚持”变成“自然发生”：
          输入要简单，分析要清楚，建议要可执行。哪怕只花几十秒，也能让每一天的财务决策更从容。
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
        <h3>你能获得什么</h3>
        <ul>
          <li>AI 记账：一句话或截图即可生成账单草稿，减少手工录入时间。</li>
          <li>AI 助手：围绕历史交易做问答和复盘，快速定位异常与趋势。</li>
          <li>交易与统计联动：从明细到趋势一体化查看，帮助你做更稳的预算决策。</li>
        </ul>
      </section>

      <section className="about-block">
        <h3>隐私与安全策略</h3>
        <ul>
          <li>
            数据存储方式：账本数据默认保存在浏览器本地存储，设备和浏览器是你的第一道权限边界。
          </li>
          <li>
            加密与传输：建议全程使用 HTTPS 接入 AI 服务，降低 API Key 与上下文在传输中的泄露风险。
          </li>
          <li>
            本地优先：统计、筛选和大部分可视化在本地完成，仅在你主动调用 AI 时发送必要上下文。
          </li>
          <li>隐私保护建议：导出或分享前可先清理备注中的手机号、订单号等敏感字段。</li>
        </ul>
      </section>
    </section>
  );
}
