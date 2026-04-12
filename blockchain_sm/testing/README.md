# Testing Stack

Lean backend and frontend for real Sepolia testing of the HoLiHu election contracts.

## Scope

- list deployed elections from `../deployments/sepolia`
- expose election config, manifest, Merkle proofs, and testing readiness through a simple API
- connect a browser wallet and interact with `ElectionV1` directly on Sepolia
- support commit, reveal, finalize, and result inspection
- show which whitelisted wallets already have enough Sepolia ETH for testing

## Structure

- `api/`: Express API for deployment metadata and Merkle proofs
- `web/`: React + Vite client for manual testing
- `docker-compose.yml`: local containerized test stack

## Current Primary Election

The default test target is election `#3` on Sepolia:

- election address: `0x28005C8780c74c68B0439dE8def8b10D251C1aa5`
- explorer: `https://sepolia.etherscan.io/address/0x28005C8780c74c68B0439dE8def8b10D251C1aa5`
- package: `E:\test_thacsi\blockchain\blockchain_sm\tmp\sepolia-metamask-test`

## Run Locally

### API

```powershell
cd E:\test_thacsi\blockchain\blockchain_sm\testing\api
npm install
npm start
```

### Web

```powershell
cd E:\test_thacsi\blockchain\blockchain_sm\testing\web
npm install
npm run dev
```

## Create A Multi-Wallet Test Election

Prepare a file containing the MetaMask addresses you want to whitelist.

Example:

```json
[
  "0x1111111111111111111111111111111111111111",
  "0x2222222222222222222222222222222222222222"
]
```

Then generate and build the election package:

```powershell
cd E:\test_thacsi\blockchain\blockchain_sm
npm run generate:metamask-election -- .\examples\metamask-addresses.sample.json .\tmp\metamask-test-input.json 24 24 10
npm run build:election -- .\tmp\metamask-test-input.json .\tmp\metamask-test
```

Then deploy:

```powershell
$env:ELECTION_CONFIG_PATH="E:\test_thacsi\blockchain\blockchain_sm\tmp\metamask-test\election-config.json"
npm run create:election -- --network sepolia
```

## Fund Whitelisted Wallets

If the MetaMask accounts do not have enough Sepolia ETH for `commit` and `reveal`, top them up from the deployer wallet:

```powershell
cd E:\test_thacsi\blockchain\blockchain_sm
$env:FUND_ELECTION_IDENTIFIER="3"
$env:FUND_TARGET_BALANCE_ETH="0.003"
npm run fund:test-voters -- --network sepolia
```

This script reads the whitelist from the election package and tops each eligible wallet up to the target balance.

## Test Election #3 With Multiple MetaMask Accounts

1. Start the testing stack.

```powershell
cd E:\test_thacsi\blockchain\blockchain_sm\testing\api
npm install
npm start
```

```powershell
cd E:\test_thacsi\blockchain\blockchain_sm\testing\web
npm install
npm run dev
```

2. Open `http://localhost:3000`.
3. Connect one of the whitelisted MetaMask accounts on Sepolia.
4. Confirm the UI shows:
   - election `#3`
   - `Eligible: true`
   - a positive Sepolia balance
5. Select a candidate and click `Commit Vote`.
6. Wait for the transaction to confirm.
7. Switch MetaMask to the next whitelisted account and repeat `Commit Vote`.
8. After the election enters the `Reveal` phase, return with each account in the same browser profile and click `Reveal Vote`.
9. After `Reveal` ends, connect the owner account and click `Finalize`.

Important:

- do not clear browser storage between commit and reveal
- the vote package is stored in localStorage per `election + wallet`
- MetaMask may show an HTTP warning because the app runs on `localhost`; this is expected for local dev
- only approve the transaction if the contract address shown by MetaMask matches election `#3`

## Docker

```powershell
cd E:\test_thacsi\blockchain\blockchain_sm\testing
docker-compose up --build
```

## Default Ports

- API: `3001`
- Web: `3000`
