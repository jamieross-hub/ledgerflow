import { useState } from 'react';
import { APP_GITHUB_URL, APP_VERSION } from '../../shared/config/app';

interface UpdateCheckResult {
  status: 'idle' | 'checking' | 'error' | 'up-to-date' | 'update-available';
  message: string;
  latestVersion?: string;
  latestUrl?: string;
}

function normalizeVersion(version: string) {
  return version.trim().replace(/^v/i, '').split('-')[0] || '0';
}

function compareVersion(a: string, b: string) {
  const left = normalizeVersion(a)
    .split('.')
    .map((item) => Number(item) || 0);
  const right = normalizeVersion(b)
    .split('.')
    .map((item) => Number(item) || 0);

  const maxLength = Math.max(left.length, right.length);
  for (let i = 0; i < maxLength; i += 1) {
    const l = left[i] ?? 0;
    const r = right[i] ?? 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }
  return 0;
}

export function AboutPage() {
  const [updateResult, setUpdateResult] = useState<UpdateCheckResult>({
    status: 'idle',
    message: ''
  });

  const handleCheckUpdate = async () => {
    setUpdateResult({ status: 'checking', message: '正在检查更新…' });
    try {
      const response = await fetch('https://api.github.com/repos/tempppw01/ledgerflow/releases/latest', {
        headers: {
          Accept: 'application/vnd.github+json'
        }
      });

      if (!response.ok) {
        throw new Error(`检查失败（HTTP ${response.status}）`);
      }

      const data = (await response.json()) as {
        tag_name?: string;
        html_url?: string;
      };

      const latestTag = data.tag_name || '';
      if (!latestTag) {
        throw new Error('未读取到最新版本号');
      }

      const cmp = compareVersion(APP_VERSION, latestTag);
      if (cmp >= 0) {
        setUpdateResult({
          status: 'up-to-date',
          message: `当前已是最新版本（v${APP_VERSION}）`,
          latestVersion: latestTag,
          latestUrl: data.html_url
        });
        return;
      }

      setUpdateResult({
        status: 'update-available',
        message: `发现新版本 ${latestTag}，可前往发布页查看变更。`,
        latestVersion: latestTag,
        latestUrl: data.html_url
      });
    } catch (error) {
      setUpdateResult({
        status: 'error',
        message: error instanceof Error ? error.message : '检查更新失败，请稍后重试。'
      });
    }
  };

  return (
    <section className="panel about-page">
      <header className="about-header">
        <h2>关于 LedgerFlow</h2>
      </header>

      <section className="about-block about-version-card">
        <h3>版本信息</h3>
        <p>
          当前版本：<strong>v{APP_VERSION}</strong>
        </p>
        <div className="about-version-actions">
          <button type="button" onClick={() => void handleCheckUpdate()}>
            {updateResult.status === 'checking' ? '检查中…' : '检查更新'}
          </button>
          <a href={`${APP_GITHUB_URL}/releases`} target="_blank" rel="noreferrer">
            查看 Releases
          </a>
        </div>
        {updateResult.message ? (
          <p className={`about-update-message ${updateResult.status}`}>{updateResult.message}</p>
        ) : null}
        {updateResult.status === 'update-available' && updateResult.latestUrl ? (
          <p>
            <a href={updateResult.latestUrl} target="_blank" rel="noreferrer">
              前往最新版本页面（{updateResult.latestVersion}）
            </a>
          </p>
        ) : null}
      </section>

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
