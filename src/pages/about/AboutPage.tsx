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
    </section>
  );
}
