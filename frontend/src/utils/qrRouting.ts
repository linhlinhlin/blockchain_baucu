import {
  buildVerifyTransactionPath,
  isTransactionHash,
  normalizeChainId,
} from './transactionVerification';

export const INVALID_SCAN_TX_MESSAGE =
  'Mã giao dịch trong đường dẫn không hợp lệ. Vui lòng kiểm tra lại QR hoặc mã tx.';

export type ScanQueryTarget =
  | { kind: 'redirect'; path: string }
  | { kind: 'error'; message: string }
  | null;

export function buildVoterVerificationPath({
  token,
  groupKey,
}: {
  token?: string | null;
  groupKey?: string | null;
}) {
  const params = new URLSearchParams();
  if (token) {
    params.set('token', token);
  } else if (groupKey) {
    params.set('groupKey', groupKey);
  }

  const query = params.toString();
  return query ? `/verify-voter?${query}` : '/verify-voter';
}

export function resolveScanQueryTarget(searchParams: URLSearchParams): ScanQueryTarget {
  const txParam = searchParams.get('tx')?.trim() ?? '';
  const tokenParam = searchParams.get('token')?.trim() ?? '';
  const groupKeyParam = searchParams.get('groupKey')?.trim() ?? '';
  const chainParam = searchParams.get('chain') ?? searchParams.get('chainId');

  if (!txParam && !tokenParam && !groupKeyParam) {
    return null;
  }

  if (txParam) {
    return isTransactionHash(txParam)
      ? { kind: 'redirect', path: buildVerifyTransactionPath(txParam, normalizeChainId(chainParam)) }
      : { kind: 'error', message: INVALID_SCAN_TX_MESSAGE };
  }

  if (tokenParam) {
    return { kind: 'redirect', path: buildVoterVerificationPath({ token: tokenParam }) };
  }

  return { kind: 'redirect', path: buildVoterVerificationPath({ groupKey: groupKeyParam }) };
}
