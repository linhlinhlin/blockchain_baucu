# AGENTS.md

Applies to: React/Vite frontend work under `frontend/`.

## Context

This frontend is React 18, Vite 6, TypeScript, ethers v6. It serves the active ElectionV1 UX: create election, manage smart contract, user elections, voter verification, and QR scanning.

Use Node 20 or 22 LTS. Node 25 is not the supported baseline.

## Commands

```powershell
npm run typecheck
npm run build
npm test -- --runInBand
```

Use `npm install --legacy-peer-deps` only when dependency installation is required and the current branch still needs it.

## Rules

- Preserve Vietnamese-first user-facing copy.
- Do not store vote secrets or sensitive wallet/auth material in plaintext persistent browser storage unless the active spec explicitly accepts the risk.
- Sanitize user-provided HTML through the existing sanitizer path.
- Keep MetaMask/Sepolia errors understandable and do not hide backend security messages.
- Prefer scoped UX fixes over broad redesigns unless the spec is explicitly UX-wide.

## Review Focus

- XSS and unsafe HTML rendering.
- localStorage/sessionStorage handling for voting flow.
- Wallet address matching before reveal.
- Loading, pending transaction, and error states.
- Accessibility of modal/dialog/status UI.
- Responsive behavior on mobile election flows.
