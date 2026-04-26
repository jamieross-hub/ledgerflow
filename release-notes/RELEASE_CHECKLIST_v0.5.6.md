# LedgerFlow v0.5.6 Release Checklist

Release target commit: `待提交`
Version tag: `v0.5.6`
Docker image:
- `34v0wphix/ledgerflow:latest`
- `34v0wphix/ledgerflow:v0.5.6`

## Scope check
- [x] Dashboard / Transactions / Assistant 当前主线拆分任务已收口
- [x] 财务分析独立页面 P0 已完成并保留闭环动作
- [x] Assistant 信贷解析与 Markdown 渲染逻辑已迁入 `features/assistant`
- [x] 页面域样式入口已继续从 `global.css` 向页面域文件收口
- [x] Smart Budget 引导与“记一笔”基础计算器优化已纳入本次版本范围
- [x] 计划目录归档兼容与主线文档状态已同步
- [x] Release notes / checklist / GitHub Release 草稿已补充

## Validation
- [x] `NODE_OPTIONS=--max-old-space-size=8192 npm test`
- [x] `npm run build`
- [x] 关键页面主链路已完成代码侧回归

## Release assets
- [x] `release-notes/RELEASE_NOTES_v0.5.6.md`
- [x] `release-notes/RELEASE_CHECKLIST_v0.5.6.md`
- [x] `release-notes/GITHUB_RELEASE_v0.5.6.md`
- [ ] 最终发布 commit hash 回填

## Recommended release steps
1. Commit release changes
2. Create git tag `v0.5.6`
3. Push commit and tag to GitHub
4. Create GitHub Release using `release-notes/RELEASE_NOTES_v0.5.6.md`
5. If Docker release is needed, publish:
   - `latest`
   - `v0.5.6`
