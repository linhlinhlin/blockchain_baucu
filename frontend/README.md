# Frontend - HoLiHu Blockchain Election

React/Vite frontend for the active ElectionV1 flow. The current app uses MetaMask on Ethereum Sepolia or a local development chain, and talks to the ASP.NET Core backend through the active `/api/election-v1/*` surface.

The old EIP-4337/private-chain UI path has been removed from the active bundle. Do not reintroduce Bundler, Paymaster, EntryPoint, HoLiHu private geth, HLU token, or session-key behavior unless a future spec explicitly restores an archived legacy path.

## Active Capabilities

- Create and manage ElectionV1 elections.
- Verify voters through QR/invite links and OTP.
- Bind wallets with signed messages.
- Commit and reveal votes with wallet ownership checks.
- Scan QR codes and view user election state.

## Stack

- React 18
- Vite 6
- TypeScript
- Redux Toolkit
- TanStack Query
- ethers v6

Use Node 20 or 22 LTS. Node 25 is outside the supported baseline for this project.

## Setup

```bash
npm install
npm run dev
```

The local Vite dev server runs on the configured frontend port, usually `http://localhost:3000`.

## Verification

```bash
npm test -- --runInBand
npm run build
```

`npm run typecheck:active` exists as a narrower active-path gate. Full typecheck can be noisy or slow on unsupported Node versions.
