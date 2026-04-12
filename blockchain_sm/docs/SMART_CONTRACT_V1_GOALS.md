# Smart Contract V1 Goals

## Context

This repository currently mixes application voting logic with custom blockchain infrastructure concerns such as a custom `EntryPoint`, custom `Paymaster`, token-based fee flows, and session-key patterns. That direction is too risky for a university election system.

The V1 rewrite moves back to a narrower goal:

- build application contracts only
- stay portable across EVM networks
- test on real public testnets before any private staging network
- keep blockchain logic minimal and auditable

## Primary Objectives

1. Build a clean EVM voting core that does not depend on custom account-abstraction infrastructure.
2. Support one election lifecycle end-to-end:
   - create election
   - verify voter eligibility
   - commit vote
   - reveal vote
   - finalize tally
3. Keep the contract set small enough to audit and test thoroughly.
4. Make the design portable to:
   - Anvil for local development
   - Sepolia for public test deployment
   - Besu QBFT later if the university needs a private production network

## Explicit Non-Goals For V1

- no custom blockchain client logic
- no custom `EntryPoint`
- no custom `Paymaster`
- no token-based gas or fee design
- no NFT ballot model
- no upgradeable running-election contracts
- no advanced privacy systems such as MACI or Semaphore yet

## V1 Contract Set

### `ElectionFactoryV1`

Responsibilities:

- register authorized election creators
- deploy immutable election instances
- provide a stable registry of created elections

### `ElectionV1`

Responsibilities:

- store election schedule and immutable metadata reference
- store candidate identifiers
- verify voter eligibility with a Merkle root
- accept a single vote commitment per eligible voter
- reveal votes during the reveal phase
- tally and finalize results

## V1 Security Principles

- election instances are immutable after deployment
- election timing is fixed at creation time
- each voter address can commit at most once
- each committed voter can reveal at most once
- commitment binds:
  - chain id
  - election contract address
  - voter address
  - candidate id
  - salt
- on-chain data stores only the minimum needed for auditability

## V1 Eligibility Model

The eligibility list is represented by a Merkle root.

Leaf format:

```solidity
keccak256(bytes.concat(keccak256(abi.encode(voterAddress))))
```

This matches the standard OpenZeppelin Merkle tree format so off-chain tooling and on-chain verification stay aligned. More privacy-preserving membership proofs can be introduced in later phases.

## Network Strategy

### Development

- local: `Anvil` or Hardhat local network

### Public test deployment

- primary: `Sepolia`

### Later private staging or production

- `Besu QBFT`

The same contracts should remain deployable on all three without logic changes.

## Acceptance Criteria For V1

1. A creator can deploy an election through the factory.
2. Election timing is validated on deployment.
3. An eligible voter can commit exactly once.
4. An ineligible voter cannot commit.
5. A committed voter can reveal exactly once.
6. Tally counts only valid reveals.
7. Election can be finalized only after the reveal window closes.
8. Tests cover the happy path and key negative cases.

## Phase After V1

Once V1 is stable on local networks and Sepolia:

- add deployment scripts
- add formal threat model
- add fuzz/property testing
- decide whether V2 should introduce:
  - anonymous membership with Semaphore
  - anti-collusion voting with MACI
  - private production deployment on Besu QBFT
