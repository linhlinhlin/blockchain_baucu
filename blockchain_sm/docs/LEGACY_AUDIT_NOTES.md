# Legacy Audit Notes

## Why The Legacy Code Was Quarantined

The original smart contract project mixed application voting logic with infrastructure and account-abstraction experiments. That produced a codebase with overlapping responsibilities, unsafe assumptions, and an unclear deployment path.

## Confirmed Critical Legacy Problems

### Multi-election logic breakage

- `idCuocBauCu` was hardcoded to `1` in the legacy ballot manager flow
- result: elections other than id `1` were logically broken

### Broken paymaster accounting

- legacy paymaster `postOp()` used `address(0)` in a way that caused the fee recovery path to fail
- result: sponsored-fee accounting was not reliable

### Custom EntryPoint risk

- the legacy project implemented its own EntryPoint-style logic
- result: high audit surface and unnecessary protocol complexity for an election application

### Unbounded loops

- some legacy flows scanned large collections linearly
- result: gas growth risk and operational fragility

### Misaligned architecture

- tokens, NFTs, paymaster logic, and session-key patterns were bundled into the election core
- result: large attack surface without proportional product value

## Current Decision

The active project no longer treats those contracts as part of the deployable system.

They remain under `legacy/` for historical reference only and are excluded from the active build, test, and deployment flow.
