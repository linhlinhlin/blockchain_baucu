# System Target 2026

## Goal

Build a real university election system that:

- runs on a standard EVM network
- is testable on Sepolia
- stays deployable without Azure lock-in
- keeps blockchain usage minimal and auditable
- is able to move to a private consortium network later if required

## Chosen Direction

### Blockchain

- application contracts on EVM
- local development on `Anvil` or Hardhat local network
- public test deployment on `Sepolia`
- optional later private production on `Besu QBFT`

### Smart Contract Tooling

- primary authoring and deployment path:
  - `Hardhat`
  - `OpenZeppelin Contracts 5`
- secondary verification path:
  - `Foundry` in Docker for Solidity-native testing
  - `Slither` in Docker for static analysis
- later advanced path:
  - `Echidna` in Docker for property fuzzing

### Backend

Target architecture:

- `ASP.NET Core` in containers
- `PostgreSQL`
- `Redis` for OTP/rate-limit/session coordination
- `MinIO` or another S3-compatible object store

Reasoning:

- the current team already has .NET context
- PostgreSQL and S3-compatible storage remove Azure lock-in
- Docker keeps the stack cloud-portable

### Frontend

- `React + Vite + TypeScript`
- wallet interaction only where necessary
- admin and voter flows should primarily be application UX, not crypto UX

## Contract Design Principles

- immutable election instances
- minimal on-chain state
- eligibility proven with Merkle proofs
- commit-reveal voting in V1
- no token economics
- no custom account abstraction
- no custom paymaster
- no user private keys handled by frontend or backend

## Security And Quality Bar

Minimum bar before public pilot:

1. unit tests for all core state transitions
2. negative tests for access control and invalid phases
3. fuzz tests for commitment behavior
4. static analysis with `Slither`
5. deployment rehearsal on local network
6. deployment rehearsal on `Sepolia`

## V1 To V2 Evolution

### V1

- auditable commit-reveal election
- eligibility via Merkle root
- results finalized on chain

### V2

- anonymous membership with `Semaphore`
- better operational tooling for election management

### V3

- anti-collusion and receipt-freeness with `MACI`

## What Is Intentionally Deferred

- mobile wallet UX
- private production chain operations
- advanced zero-knowledge voting
- multi-election governance and delegated voting models

These are not rejected. They are deferred until the core election contract is stable, tested, and deployed successfully on Sepolia.
