# 计划目录说明

LedgerFlow 的计划文件已从“按日期命名”调整为“按版本命名”。

## 目录结构（当前约定）

- `plans/`：当前主线 + 当前正在执行的计划文件
- `plans/archive/`：历史计划归档（已完成/不再作为主线推进的文件，保留用于追溯）
- `plans/已完成汇总.md`：已完成任务归档（按任务维度追加记录）

## 优先阅读顺序

1. `plans/VERSIONS.md` —— 查看版本计划索引
2. 当前执行计划：`plans/0.2.0-嵌入渠道独立设置计划.md`
3. 后续版本候选：`plans/v0.5.2-chart-visual-redesign.md` / `plans/v0.6.0-user-system-collaboration.md`

已完成并归档：`plans/archive/v0.5.0-信贷管理增强计划.md`、`plans/archive/v0.5.1-交易可见性远程数据库分享增强计划.md`

## 命名规范

- 旧：`xxx-2026-02-27.md`
- 新：`v<版本号>-<主题>.md` 或中文主计划文件名（例如：`交易页聚焦流水计划.md`）

## 原则

- 主线工作优先写入主计划文件
- 历史版本计划与兼容入口移动到 `plans/archive/`
