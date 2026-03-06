import { Link } from 'react-router-dom';

export function HelpPage() {
  return (
    <section className="panel help-page">
      <header className="help-header">
        <h2>帮助与快捷方式</h2>
        <p>把首页的新手引导与快捷操作集中到这里，首页只保留更轻的入口。</p>
      </header>

      <section className="help-block">
        <h3>三步开始使用</h3>
        <ol>
          <li>先添加一笔交易，确认收支、分类和账户字段是否符合你的习惯。</li>
          <li>再打开智能预算或还款管理，检查系统是否能基于你的数据给出有效建议。</li>
          <li>最后进入设置页补齐 AI / 备份配置，让分析、导入和同步链路完整闭环。</li>
        </ol>
      </section>

      <section className="help-block">
        <h3>常用快捷方式</h3>
        <div className="help-shortcut-list">
          <p><kbd>N</kbd><span>快速新增一笔交易</span></p>
          <p><kbd>B</kbd><span>打开 Smart Budget</span></p>
          <p><kbd>/</kbd><span>进入交易记录并开始检索</span></p>
        </div>
      </section>

      <section className="help-block">
        <h3>推荐入口</h3>
        <div className="help-link-grid">
          <Link to="/assistant" className="help-link-card">
            <strong>AI 记账助手</strong>
            <span>适合快速记账、问答分析和收支建议。</span>
          </Link>
          <Link to="/transactions?quickAdd=1&entry=help" className="help-link-card">
            <strong>快速新增交易</strong>
            <span>直接进入新增页，最快开始沉淀你的第一批流水。</span>
          </Link>
          <Link to="/smart-budget" className="help-link-card">
            <strong>Smart Budget</strong>
            <span>做预算、看偏差、调整月度节奏。</span>
          </Link>
          <Link to="/settings" className="help-link-card">
            <strong>系统设置</strong>
            <span>补齐模型、数据库和同步配置。</span>
          </Link>
        </div>
      </section>
    </section>
  );
}
