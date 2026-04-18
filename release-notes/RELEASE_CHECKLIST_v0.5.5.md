# LedgerFlow v0.5.5 Release Checklist

Release target commit: `332f6e4`
Version tag: `v0.5.5`
Docker image:
- `34v0wphix/ledgerflow:latest`
- `34v0wphix/ledgerflow:v0.5.5`

## Scope check
- [x] 财务分析独立页面骨架已落地
- [x] 页面结构继续收口（Dashboard / Transactions / Assistant 方向延续）
- [x] Dashboard / 分类结构 / 趋势区体验问题已收口到本次版本范围
- [x] WebDAV 恢复列表时间标签问题已修复
- [x] 计划目录已整理为单一主线计划模式
- [x] `plans/当前主线计划.md` 已建立
- [x] `plans/README.md` 与 `plans/VERSIONS.md` 已同步重写
- [x] 已完成计划文件已从 `plans/` 根目录清理
- [x] Release notes 已补充

## Validation
- [ ] `npm run build`
- [ ] 关键页面手工回归
- [ ] 如需发布 Docker，确认镜像构建与推送

## Release assets
- [x] `release-notes/RELEASE_NOTES_v0.5.5.md`
- [ ] GitHub Release 草稿文案
- [ ] 最终发布 commit hash 回填

## Recommended release steps
1. Run `npm run build`
2. Commit release changes
3. Create git tag `v0.5.5`
4. Push commit and tag to GitHub
5. Create GitHub Release using `release-notes/RELEASE_NOTES_v0.5.5.md`
6. Keep Docker Hub tags:
   - `latest`
   - `v0.5.5`
