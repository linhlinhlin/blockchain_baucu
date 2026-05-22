export const SEPOLIA_CHAIN_ID = 11155111;
export const DEFAULT_SEPOLIA_RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
export const DEFAULT_SEPOLIA_EXPLORER_BASE_URL = 'https://sepolia.etherscan.io';

const TRANSACTION_HASH_PATTERN = /^0x[a-fA-F0-9]{64}$/;

export type TransactionVerificationTarget = {
  txHash: string;
  chainId: number;
};

export function isTransactionHash(value?: string | null) {
  return Boolean(value && TRANSACTION_HASH_PATTERN.test(value.trim()));
}

export function normalizeChainId(value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return SEPOLIA_CHAIN_ID;
  }

  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : SEPOLIA_CHAIN_ID;
}

export function normalizeExplorerBaseUrl(value?: string | null) {
  return (value || DEFAULT_SEPOLIA_EXPLORER_BASE_URL).replace(/\/+$/, '');
}

export function buildExplorerTransactionUrl(txHash: string, explorerBaseUrl?: string | null) {
  return `${normalizeExplorerBaseUrl(explorerBaseUrl)}/tx/${txHash}`;
}

export function buildVerifyTransactionPath(txHash: string, chainId = SEPOLIA_CHAIN_ID) {
  return `/verify-tx?chain=${encodeURIComponent(String(chainId))}&tx=${encodeURIComponent(txHash)}`;
}

export function buildVerifyTransactionUrl(txHash: string, chainId = SEPOLIA_CHAIN_ID) {
  const origin = typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin;
  return `${origin}${buildVerifyTransactionPath(txHash, chainId)}`;
}

export function extractExplorerTransactionHash(url: URL) {
  const host = url.hostname.toLowerCase();
  if (!host.endsWith('etherscan.io')) {
    return null;
  }

  const parts = url.pathname.split('/').filter(Boolean);
  const txIndex = parts.findIndex((part) => part.toLowerCase() === 'tx');
  const candidate = txIndex >= 0 ? parts[txIndex + 1] : null;
  return candidate && isTransactionHash(candidate) ? candidate : null;
}

function inferExplorerChainId(url: URL) {
  const host = url.hostname.toLowerCase();
  if (host === 'sepolia.etherscan.io') {
    return SEPOLIA_CHAIN_ID;
  }
  if (host === 'etherscan.io' || host === 'www.etherscan.io') {
    return 1;
  }
  return SEPOLIA_CHAIN_ID;
}

export function extractVerifyTransactionTarget(url: URL): TransactionVerificationTarget | null {
  const path = url.pathname.toLowerCase();
  const txParam = url.searchParams.get('tx');
  if (path.includes('/verify-tx') && txParam && isTransactionHash(txParam)) {
    return {
      txHash: txParam,
      chainId: normalizeChainId(url.searchParams.get('chain') ?? url.searchParams.get('chainId')),
    };
  }

  const explorerTxHash = extractExplorerTransactionHash(url);
  if (explorerTxHash) {
    return {
      txHash: explorerTxHash,
      chainId: normalizeChainId(
        url.searchParams.get('chain') ?? url.searchParams.get('chainId') ?? inferExplorerChainId(url),
      ),
    };
  }

  return null;
}
