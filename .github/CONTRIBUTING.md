# Contributing to LedgerFlow

Thanks for contributing.

## Development basics

```bash
npm install
npm run dev
npm run test
npm run build
```

## Before opening a PR

Please make sure:
- build passes
- related tests pass
- UI changes are checked on both normal and narrow layouts
- new behavior is reflected in docs or inline comments when helpful

## Preferred change style

- keep scope tight
- prefer consistency over one-off patches
- avoid introducing isolated UI patterns
- preserve auditability for finance-related flows

## Areas that deserve extra care

- transactions and categorization
- debt / repayment calculations
- budget tracking
- WebDAV upload / backup flows
- any AI-assisted structured output parsing
