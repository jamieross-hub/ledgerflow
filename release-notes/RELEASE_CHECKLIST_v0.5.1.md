# LedgerFlow v0.5.1 Release Checklist

Release target commit: `6919d98`
Version tag: `v0.5.1`
Docker image:
- `34v0wphix/ledgerflow:latest`
- `34v0wphix/ledgerflow:v0.5.1`

## Scope check
- [x] 交易列表附件标志
- [x] 交易最后修改时间
- [x] 远程 MySQL 配置入口
- [x] 远程 MySQL 接入边界梳理
- [x] 账单分享入口
- [x] 分享模板（完整 / 脱敏 / 摘要）
- [x] 移动端 dashboard 空白收紧
- [x] README 补测试 Demo
- [x] Release notes 已补充
- [x] Docker 多架构镜像已发布

## Validation
- [x] `npm run build`
- [x] 相关 transaction tests passed
- [x] Docker multi-arch push verified

## Release assets
- [x] `release-notes/RELEASE_NOTES_v0.5.1.md`
- [x] README live demo link
- [x] README fixed version docker example

## Recommended release steps
1. Create git tag `v0.5.1`
2. Push tag to GitHub
3. Create GitHub Release using `release-notes/RELEASE_NOTES_v0.5.1.md`
4. Keep Docker Hub tags:
   - `latest`
   - `v0.5.1`
