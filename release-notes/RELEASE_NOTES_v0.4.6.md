# LedgerFlow v0.4.6 Release Notes

## 版本定位
`v0.4.6` 是一版针对 AI 助手与记账主流程的整理收口，核心方向：让交互更顺、内容更聚焦、操作更连贯。

## 完成的主要改动
1. **AI 助手连续问答体验**
   - 回答下方新增联想/追问词，下一轮提问更平滑。
   - 仅在 assistant 模式启用追问词，避免 bookkeeping 录入干扰。
2. **AI 助手支持流式响应**
   - 复用现有 OpenAI 兼容流式客户端，assistant 模式能逐字生成。
   - 流式内容不再塞入历史消息表，只有完成后才写入，避免占位干扰。
3. **AI 记账保存后清理 JSON 残留**
   - 成功保存后清空 rawContent/rawReasoning/lastUsage，避免长 JSON 占位。
   - bookkeeping 模式只在结果里写入用户可读摘要。
4. **首页去冗余 + 入口清晰**
   - Dashboard 把 Getting Started 拆成精简 inline help。
   - 入口按钮明确引导到 Help、Assistant、快速记账。
5. **更多键盘快捷方式**
   - 补全 A、G、H、D 两个新全局按键、保证输入态/组合键不冲突。
   - Help 页“常用快捷方式”同步更新。
6. **“记一笔”页面 UI/UX 收口**
   - 主输入区重排：金额与日期在前，基础信息/备注/标签在后。
   - 计算器改成只支持加减，快速模式下默认隐藏，强调手动输入。
   - 统一表单段落、按钮、错误反馈，提升视觉密度与操作直觉。

## 构建与验证
- `npm run build` 通过。
- 仍有 chunk size warning（Vite 输出），属于后续性能优化。

## 感谢
- 特别感谢协助提供跨页快捷加载思路的团队 rolling log。