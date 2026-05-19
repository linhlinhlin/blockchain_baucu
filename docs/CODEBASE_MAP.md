# Codebase Map

This map helps agents find the right context before opening many files. Keep it short and update it when active responsibilities move.

## Root

- `AGENTS.md`: repository-level agent instructions.
- `CLAUDE.md`: existing Claude Code orientation. Useful context, but prefer `AGENTS.md` for Codex.
- `.specify/`: Spec Kit constitution, scripts, templates, and active feature specs.
- `docs/audit/`: current security/remediation truth. `AUDIT_2026-05-18.md` is the main audit index.
- `CURRENT_APP_ELECTIONV1_RUNBOOK.md`: manual runbook for the active ElectionV1 app flow.
- `DOCKER_ACTIVE_STACK.md`: active Docker stack guide.
- `docker-compose.active.yml`: local active stack.
- `SYSTEM_MODERNIZATION_REVIEW_2026-04-10.md`: historical review; some claims are stale.

## Smart Contracts: `blockchain_sm/`

- `contracts/ElectionV1.sol`: active commit-reveal election contract.
- `contracts/ElectionFactoryV1.sol`: active factory/deployment contract.
- `scripts/`: helper scripts for deploy, create election, commit, reveal, finalize, verify, eligibility tree, and readiness checks.
- `test/ElectionFactoryV1.test.js`: active Hardhat test target.
- `foundry.toml`: Foundry config.
- `legacy/`: frozen account-abstraction and old flow code. Do not expand active behavior here.
- `deployments/`: runtime/deployment artifacts; should stay out of source control.

## Backend: `WebApplication3/WebApplication3/WebApplication3/`

- `Program.cs`: service registration, auth, CORS, rate limiting, hosted services, and app pipeline.
- `Controllers/ElectionV1Controller.cs`: active ElectionV1 API.
- `Services/ElectionV1CreateService.cs`: create/deploy ElectionV1 workflow.
- `Services/ElectionV1ReadService.cs`: read ElectionV1 state/deployment records.
- `Services/ElectionV1RosterService.cs`: roster, invite, OTP, wallet binding.
- `Data/ElectionV1StoreDbContext.cs`: active PostgreSQL store.
- `Infrastructure/`: config, legacy gating, dev auth store, transient context factory.
- `Service/`: older services including legacy blockchain/storage integrations.
- `Models/`: DTOs and EF/domain models.
- `Migrations/`: existing EF migrations.

## Frontend: `frontend/`

- `src/index.tsx`: app entry.
- `src/context/Web3Context.tsx`: wallet/network context for active flow.
- `src/api/` and `src/services/`: backend API clients and service helpers.
- `src/pages/` or route components: active election creation, management, user elections, QR/OTP verification.
- `src/utils/sanitizeHtml.ts`: HTML sanitization helper.
- `src/__tests__/`: current frontend tests.
- `src/test/**` may be legacy or already removed depending on branch state; verify before relying on it.

## Testing/Flow Sandboxes

- `blockchain_sm/testing/`: older testing surfaces.
- `blockchain_sm/testing/flow/`: wallet-login flow API and web sandbox.
- These are useful for experiments, but do not treat them as production active path unless the current spec says so.

## Change Routing

- Contract behavior: start with `blockchain_sm/AGENTS.md`, active contracts, then `blockchain_sm` tests and audit docs.
- Backend ElectionV1 behavior: start with backend `AGENTS.md`, `ElectionV1Controller`, services, store context, then audit/spec.
- Frontend UX: start with `frontend/AGENTS.md`, active route/page, API client, Web3 context, and sanitizer utilities.
- Infra/runbook: start with `DOCKER_ACTIVE_STACK.md`, `docker-compose.active.yml`, Dockerfiles, `.env.example`, and active stack docs.
- Spec/remediation: start with `.specify/memory/constitution.md`, `docs/audit/REMEDIATION_BACKLOG.md`, and the relevant `.specify/specs/<feature>/`.
