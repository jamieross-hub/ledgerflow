# LedgerFlow 代码审计与产品优化清单

> 日期：2026-02-26
> 范围：前端静态审计（不改代码）

## 一、审计范围

- 前端依赖与脚本：`package.json`
- AI 请求与流式解析：`src/features/assistant/api/openaiCompatibleClient.ts`
- 备份与 WebDAV：`src/shared/lib/backup.ts`
- 本地敏感信息存储：`src/shared/store/useAiSettings.ts`、`src/features/connection-config/model/connectionStorage.ts`
- 导入与数据替换链路：`src/shared/lib/backup.ts`、`src/shared/store/useFinanceStore.ts`

---

## 二、漏洞与缺陷清单

### 高风险

1. WebDAV 代理目标可被前端输入控制（依赖服务端是否做限制）
   - 证据：前端将 endpoint 透传到 `X-WebDAV-Endpoint`
   - 风险：若服务端信任该值，可能触发 SSRF/内网探测
   - 建议：服务端白名单 + 协议/网段限制 + 审计日志

2. AI 地址允许 HTTP，API Key 存在明文传输风险
   - 证据：AI Base URL 校验允许 `http` 与 `https`
   - 风险：非 TLS 网络下 Key 与上下文可能泄漏
   - 建议：生产强制 HTTPS，仅开发环境可放宽

### 中风险

3. 后端错误明文回显到前端
   - 证据：异常信息拼接 `response.text()`
   - 风险：泄露后端实现细节、网关信息
   - 建议：用户侧展示通用错误码，详情写调试日志并脱敏

4. 备份导入缺少字段级 Schema 严校验
   - 证据：仅做数组结构判断后即类型断言
   - 风险：脏数据导入、边界值异常、潜在性能抖动
   - 建议：引入字段级 schema + 长度/范围/枚举校验

5. 会话存储中的敏感字段仍受 XSS 威胁
   - 证据：API Key/连接密码存于 sessionStorage
   - 风险：一旦出现 XSS 可被直接读取
   - 建议：强化 CSP、收敛第三方脚本、缩短密钥生命周期

### 低风险

6. 流式解析坏包静默忽略，可观测性不足
   - 建议：记录解析错误计数、requestId、失败分段

7. 安全文案充分，但技术防线尚未默认强制
   - 建议：将提示升级为前端拦截 + 服务端策略

---

## 三、产品优化建议清单

### 安全

- 生产环境默认安全：强制 HTTPS、代理白名单、最小权限
- 敏感数据治理：短期令牌、自动失效、一键清除
- 统一脱敏层：错误提示/日志/导出数据统一脱敏

### 稳定性

- 导入流程三段式：预校验 → 预览差异 → 确认落库
- 大文件导入支持取消与回滚
- 备份与账单增加 schema 版本迁移机制

### 可用性

- 增加安全状态卡：TLS、代理、密钥状态、最近失败原因
- 错误提示分层：用户文案 + 可复制诊断码
- 导入后生成报告：新增/更新/跳过/失败明细

### 可观测性

- 关键链路统一 requestId 与耗时指标
- 埋点监控：成功率、重试率、解析失败率
- 异常分级告警：网络层、解析层、数据层

---

## 四、建议实施顺序（计划）

1. 封堵高风险：代理目标约束 + 生产 HTTPS 强制
2. 数据入口治理：备份/账单 schema 严校验 + 预检机制
3. 可观测性补齐：统一错误码、审计日志、关键指标

---

## 五、高风险修复进展（2026-02-26）

### 已完成

1. WebDAV 配置安全收敛（前端侧）
   - 新增配置规范化与校验：仅允许 HTTPS、拒绝 localhost/内网地址、拒绝非法代理路径、拒绝不合法远程文件路径。
   - 落地点：`src/shared/lib/backup.ts`（`sanitizeWebdavConfig` 及配套规范化函数）。
   - 联动：页面保存/上传/下载前统一走配置校验，避免不安全配置进入请求。

2. AI Base URL 强制 HTTPS
   - 调整 URL 校验为仅允许 `https:`。
   - 落地点：`src/features/assistant/api/openaiCompatibleClient.ts`（`normalizeBaseUrl`）。

3. 安全提示文案增强
   - 在 WebDAV 同步区明确“仅允许 HTTPS 且拒绝 localhost/内网地址”。
   - 落地点：`src/pages/database-settings/DatabaseSettingsPage.tsx`。

### 测试验证

- 新增/更新测试：
  - `src/shared/lib/backup.test.ts`
    - 覆盖 HTTPS 限制、内网地址拒绝、代理路径与远程路径规范化、非法空段路径拒绝、危险 endpoint 阻断请求。
  - `src/features/assistant/api/openaiCompatibleClient.test.ts`
    - 覆盖非 HTTPS（含 `http`）拒绝。
- 回归结果：
  - `npm run test -- src/shared/lib/backup.test.ts src/features/assistant/api/openaiCompatibleClient.test.ts`
  - 结果：2 个测试文件全部通过（10/10）。

### 仍需服务端配合（高优先）

- 前端已收敛输入，但 SSRF 的根本防线必须在代理服务端落实：
  - 忽略前端任意目标或采用强白名单；
  - 禁止回环/内网/链路本地地址；
  - 记录代理审计日志并限流。
