import type { ElectionV1GroupListItem } from '../api/electionV1Api';

export function getErrorMessage(error: unknown): string {
  const maybeError = error as any;
  if (maybeError?.response?.data?.Error) {
    return maybeError.response.data.Error;
  }
  if (maybeError?.response?.data?.error) {
    return maybeError.response.data.error;
  }
  if (maybeError instanceof Error) {
    return maybeError.message;
  }
  return 'Không thể tải dữ liệu ElectionV1. Vui lòng thử lại.';
}

export function normalizeAddress(value?: string | null): string {
  return value?.trim().toLowerCase() ?? '';
}

export function shortenAddress(value?: string | null): string {
  if (!value) {
    return '—';
  }
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function formatUnix(timestamp?: number | null): string {
  if (!timestamp) {
    return '—';
  }
  return new Intl.DateTimeFormat('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(timestamp * 1000));
}

export function getPhaseLabel(item: ElectionV1GroupListItem): string {
  const now = Math.floor(Date.now() / 1000);
  if (now < item.commitStart) {
    return 'Chờ bắt đầu';
  }
  if (now < item.commitEnd) {
    return 'Đang bỏ phiếu';
  }
  if (now < item.revealEnd) {
    return 'Kiểm phiếu';
  }
  return 'Đã kết thúc';
}

export function phaseClasses(label: string): string {
  switch (label) {
    case 'Đang bỏ phiếu':
      return 'border-[rgba(208,138,17,0.22)] bg-[rgba(248,204,101,0.3)] text-[var(--clay-text)]';
    case 'Kiểm phiếu':
      return 'border-[rgba(1,65,141,0.2)] bg-[rgba(59,211,253,0.24)] text-[var(--clay-text)]';
    case 'Đã kết thúc':
      return 'border-[var(--clay-border)] bg-[rgba(255,255,255,0.78)] text-[var(--clay-text)]';
    default:
      // 'Chờ bắt đầu'
      return 'border-[rgba(67,8,159,0.2)] bg-[rgba(193,176,255,0.24)] text-[var(--clay-text)]';
  }
}
