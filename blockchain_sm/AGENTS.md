# AGENTS.md

Applies to: smart contract and blockchain helper work under `blockchain_sm/`.

## Context

Active contracts are `contracts/ElectionFactoryV1.sol` and `contracts/ElectionV1.sol`. The legacy account-abstraction stack under `legacy/` is frozen and must not be expanded into the active path.

Use local Hardhat through npm scripts. Do not use `npx hardhat`.

## Commands

```powershell
npm run compile
npm test
```

Optional when tools are installed:

```powershell
npm run test:foundry
npm run analyze:slither
npm run validate
```

## Rules

- Preserve commit-reveal domain separation and replay/double-vote protections.
- Treat `SEPOLIA_RPC_URL`, private keys, factory addresses for live deployments, and deployment artifacts as sensitive.
- Do not commit `deployments/`, Hardhat artifacts/cache, Foundry output, or local `.env`.
- Any change to finalize/quorum/phase semantics must reference the active spec and update tests.
- Keep `legacy/` isolated unless the task is explicitly cleanup/removal.

## Review Focus

- Merkle eligibility correctness.
- Commit/reveal/finalize phase boundaries.
- Candidate validity, replay resistance, double-commit/reveal behavior.
- Event coverage for auditability.
- Tooling scripts that touch live networks or private keys.
