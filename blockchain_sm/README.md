# HoLiHu Election Contracts

Clean EVM application contracts for the HoLiHu election system.

## Active Scope

The active codebase contains only the new election core:

- `ElectionFactoryV1`
- `ElectionV1`
- Hardhat unit tests
- Foundry fuzz tests
- Slither static analysis
- Sepolia deployment scripts

Legacy code has been quarantined under `legacy/` and is no longer part of the active workflow.

## Architecture

- EVM application contracts only
- no custom account abstraction
- no custom paymaster
- no token-based fee design
- eligibility via OpenZeppelin Merkle tree proofs
- commit-reveal voting for V1

## Main Commands

```bash
npm install
npm run compile
npm run test
npm run test:foundry
npm run analyze:slither
npm run validate
npm run check:sepolia
npm run generate:quick-election -- ./tmp/sepolia-smoke-input.json
```

## Build A Deployment Package

Generate a canonical manifest, eligibility tree, and deployment config from one reviewed input file:

```bash
npm run build:election -- ./examples/election-package.sample.json ./tmp/sepolia-demo
```

This writes:

- `manifest.json`
- `manifest.pretty.json`
- `eligibility-tree.json`
- `election-config.json`
- `summary.json`

## Deployment

Local deploy:

```bash
npm run deploy:factory -- --network localhost
```

Sepolia deploy:

```bash
npm run check:sepolia
npm run deploy:factory -- --network sepolia
npm run create:election -- --network sepolia
npm run verify:factory -- --network sepolia
npm run verify:election -- --network sepolia
```

Create an election:

```bash
$env:ELECTION_CONFIG_PATH="E:\path\to\election-config.json"
npm run create:election -- --network sepolia
```

## Smoke Test On Sepolia

Generate a short-lived election package:

```bash
npm run generate:quick-election -- ./tmp/sepolia-smoke-input.json 180 180 -30
npm run build:election -- ./tmp/sepolia-smoke-input.json ./tmp/sepolia-smoke
```

Then:

```bash
$env:ELECTION_CONFIG_PATH="E:\path\to\tmp\sepolia-smoke\election-config.json"
npm run create:election -- --network sepolia
$env:VOTE_PACKAGE_PATH="E:\path\to\tmp\sepolia-smoke\vote-package.json"
$env:CANDIDATE_INDEX="0"
npm run build:vote -- --network sepolia
npm run commit:vote -- --network sepolia
npm run reveal:vote -- --network sepolia
npm run finalize:election -- --network sepolia
```

See:

- [`docs/SMART_CONTRACT_V1_GOALS.md`](./docs/SMART_CONTRACT_V1_GOALS.md)
- [`docs/SYSTEM_TARGET_2026.md`](./docs/SYSTEM_TARGET_2026.md)
- [`docs/SEPOLIA_RUNBOOK.md`](./docs/SEPOLIA_RUNBOOK.md)
- [`docs/LEGACY_AUDIT_NOTES.md`](./docs/LEGACY_AUDIT_NOTES.md)
