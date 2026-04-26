# GitHub Release Draft — v0.5.6

## LedgerFlow v0.5.6

LedgerFlow v0.5.6 focuses on **closing the current mainline cleanly**: finishing the first Financial Analysis delivery, completing the remaining high-frequency page modularization work, and syncing the planning/release workflow so the shipped state matches the repo state.

### Highlights
- Finished the current-mainline modularization pass across Dashboard, Transactions, and Assistant
- Completed the Financial Analysis P0 page with past / present / future action loops
- Moved assistant credit parsing and markdown rendering responsibilities into `features/assistant`
- Fixed installment repayment date expansion to use local calendar logic instead of UTC-shifted dates
- Improved Smart Budget onboarding clarity and simplified the daily calculator back to a practical basic mode
- Synced versioning, release notes, plan archive compatibility files, and current-mainline documentation for `v0.5.6`

### Validation
- `NODE_OPTIONS=--max-old-space-size=8192 npm test`
- `npm run build`

### Docker
- `34v0wphix/ledgerflow:latest`
- `34v0wphix/ledgerflow:v0.5.6`

### Full notes
See: `release-notes/RELEASE_NOTES_v0.5.6.md`

### Release commit
- `待提交`
