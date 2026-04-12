# Election V1 Flow Stack

This stack now targets the serious Sepolia application-contract flow:

- wallet connect
- wallet sign-in to backend
- choose an `ElectionV1` instance
- create new elections through `ElectionFactoryV1`
- commit vote on-chain
- reveal vote on-chain
- finalize the election on-chain
- inspect revealed results and on-chain activity history

## Scope

- smart contracts:
  - `E:\test_thacsi\blockchain\blockchain_sm\contracts\ElectionFactoryV1.sol`
  - `E:\test_thacsi\blockchain\blockchain_sm\contracts\ElectionV1.sol`
- backend: Node + Express + Postgres
- frontend: React + Vite
- network: Sepolia

This flow is still **commit-reveal, not anonymous voting**. It is the target operational flow before moving to a stronger privacy layer such as Semaphore or MACI.

## What The API Stores

- wallet login sessions and login history in Postgres
- synced on-chain activity history in Postgres
- deployment records in `E:\test_thacsi\blockchain\blockchain_sm\deployments\sepolia`

Each deployment record now carries the election bundle data needed by the UI and Docker runtime:

- `config`
- `manifest`
- `summary`
- `eligibility`

This avoids depending on machine-specific absolute paths during Docker deployment.

## Election Creation From UI

The frontend includes a self-service create form for testing.

- the backend generates the Merkle tree and manifest bundle
- the backend calls `ElectionFactoryV1.createElection(...)` on Sepolia
- the new election is written to `deployments\sepolia`
- by default, self-service creation is enabled for any signed-in wallet
- set `FLOW_ALLOW_SELF_SERVICE_ELECTION_CREATION=false` to lock this down

## Run Locally

### API

```powershell
cd E:\test_thacsi\blockchain\blockchain_sm\testing\flow\api
npm install
npm start
```

### Web

```powershell
cd E:\test_thacsi\blockchain\blockchain_sm\testing\flow\web
npm install
npm run dev
```

### Postgres

```powershell
docker run --name holihu-flow-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -e POSTGRES_DB=holihu_flow -p 5433:5432 -d postgres:17-alpine
```

Then the API will auto-run the schema from `db/init.sql`.

## Run With Docker Compose

```powershell
cd E:\test_thacsi\blockchain\blockchain_sm\testing\flow
docker-compose up --build
```

## Default Ports

- web: `http://localhost:3200`
- api: `http://localhost:3201`
- postgres: `localhost:5433`

## Test Flow

1. Open `http://localhost:3200`
2. Connect MetaMask on Sepolia
3. Click `Sign In With Wallet`
4. Select an existing election or create a new one from the form
5. During `Commit`, click `Commit Vote` for one candidate
6. During `Reveal`, click `Reveal Vote` from the same wallet and same browser
7. After `Reveal` ends, click `Finalize`
8. Check:
   - revealed results
   - total commits and reveals
   - on-chain activity history
   - login history

## Notes

- `Reveal Vote` requires the local vote package stored in the browser that performed the commit.
- `Finalize` is permissionless in the current `ElectionV1` contract once the election has reached `Ended`.
- Because the current contract is commit-reveal, results only count revealed votes.
