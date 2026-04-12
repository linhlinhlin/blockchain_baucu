# Sepolia Runbook

## Purpose

This runbook describes the operational path to deploy the clean election contracts to Sepolia with reproducible artifacts and minimal manual steps.

## Prerequisites

1. A Sepolia RPC endpoint
2. A funded Sepolia deployer account
3. A local `.env` file created from `.env.example`
4. A reviewed election package input file

Example `.env`:

```env
ETHERSCAN_API_KEY=...
SEPOLIA_RPC_URL=https://...
SEPOLIA_PRIVATE_KEYS=0x...
```

## Step 1: Validate the codebase first

Run the full local gate before touching Sepolia:

```bash
npm install
npm run validate
```

Only proceed once all tests and analysis pass.

## Step 2: Check Sepolia readiness

Make sure your `.env` is wired correctly and the RPC really points to Sepolia:

```bash
npm run check:sepolia
```

This checks:

- RPC connectivity
- chain id is `11155111`
- deployer address
- deployer balance
- optional Etherscan verify readiness

## Step 3: Prepare one election package input

Start from the sample file:

```bash
copy .\examples\election-package.sample.json .\tmp-election-package.json
```

Edit:

- `admin`
- `electionURI`
- `schedule`
- `candidates`
- `voters`
- `manifest`

Notes:

- `candidates[].id` must be stable and unique. Example: `candidate:SV001`
- `electionURI` should point to immutable metadata such as an IPFS CID
- if you need the final manifest before pinning to IPFS, run the next step once, pin the generated `manifest.json`, update `electionURI`, then run the step again

## Step 4: Generate the canonical deployment artifacts

```bash
npm run build:election -- .\tmp-election-package.json .\tmp\sepolia-election
```

This writes:

- `manifest.json`
- `manifest.pretty.json`
- `eligibility-tree.json`
- `election-config.json`
- `summary.json`

The generated manifest hash becomes `electionMetadataHash`, and the Merkle tree root becomes `eligibleVotersRoot`.

Important:

- `manifest.json` is the canonical file whose exact UTF-8 bytes are hashed into `electionMetadataHash`
- `manifest.pretty.json` is only for human review
- if you pin the manifest to IPFS, pin `manifest.json`, not `manifest.pretty.json`

## Step 5: Deploy the factory

```bash
npm run deploy:factory -- --network sepolia
```

The script stores the result in:

- `deployments/sepolia/factory-latest.json`

It also writes a timestamped snapshot for audit history.

## Step 6: Create the election

Set the generated config file path:

```powershell
$env:ELECTION_CONFIG_PATH="E:\test_thacsi\blockchain\blockchain_sm\tmp\sepolia-election\election-config.json"
```

If you want to override the factory address manually:

```powershell
$env:FACTORY_ADDRESS="0x..."
```

Then create the election:

```bash
npm run create:election -- --network sepolia
```

The script will:

- use `FACTORY_ADDRESS` if provided
- otherwise fall back to `deployments/sepolia/factory-latest.json`
- save the created election record to `deployments/sepolia/election-latest.json`

Record:

- election id
- election address
- factory address
- transaction hash

## Step 7: Verify the contracts on the explorer

After the deployment is indexed by the explorer:

```bash
npm run verify:factory -- --network sepolia
npm run verify:election -- --network sepolia
```

These commands use the saved deployment records, so you do not need to retype constructor arguments.

## Step 8: Store the final operational bundle

Keep these files together for audit and later FE/BE integration:

- `manifest.json`
- `manifest.pretty.json`
- `eligibility-tree.json`
- `election-config.json`
- `summary.json`
- `deployments/sepolia/factory-latest.json`
- `deployments/sepolia/election-latest.json`

## Operational Notes

1. The eligibility tree generation process must be reproducible and reviewed.
2. The same manifest file that produced `electionMetadataHash` should be the one pinned to immutable storage.
3. Commit and reveal timestamps must be communicated clearly to voters before opening the election.
4. Reveal salts must be handled securely by the application layer.
5. No private keys should ever be collected through frontend forms.

## Optional Smoke Test Flow

If you want to prove the full commit -> reveal -> finalize path on Sepolia without waiting for a long election:

```bash
npm run generate:quick-election -- .\tmp\sepolia-smoke-input.json 180 180 -30
npm run build:election -- .\tmp\sepolia-smoke-input.json .\tmp\sepolia-smoke
```

Then point `ELECTION_CONFIG_PATH` at the generated smoke config and run:

```bash
npm run create:election -- --network sepolia
npm run build:vote -- --network sepolia
npm run commit:vote -- --network sepolia
npm run reveal:vote -- --network sepolia
npm run finalize:election -- --network sepolia
```

Notes:

1. `generate:quick-election` uses the first private key in `SEPOLIA_PRIVATE_KEYS` as both admin and the single eligible voter.
2. `build:vote` writes a reusable vote package containing the commitment, proof, and reveal salt.
3. For smoke tests, the generated package uses `embedManifestAsDataUri: true` so the metadata URI is self-contained and does not depend on IPFS.
