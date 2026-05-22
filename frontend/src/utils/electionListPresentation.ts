import type { ElectionV1GroupListItem } from '../api/electionV1Api';
import { getPhaseLabel, normalizeAddress } from './electionHelpers';

export interface ElectionListStats {
  total: number;
  pending: number;
  commit: number;
  reveal: number;
  ended: number;
}

export interface ElectionGroupMilestone {
  label: string;
  timestamp: number;
}

export function buildElectionConsolePath(groupKey: string, electionAddress?: string | null): string {
  const params = new URLSearchParams({ group: groupKey });
  if (electionAddress) {
    params.set('election', electionAddress);
  }

  return `/app/dashboard?${params.toString()}`;
}

export function filterElectionGroups(
  items: ElectionV1GroupListItem[],
  searchTerm: string,
  mineOnly: boolean,
  knownWallets: ReadonlySet<string>,
): ElectionV1GroupListItem[] {
  const normalizedQuery = searchTerm.trim().toLowerCase();
  const normalizedWallets = new Set(
    Array.from(knownWallets).map(normalizeAddress).filter(Boolean),
  );

  return items.filter((item) => {
    const haystack = [
      item.title,
      item.description,
      item.groupKey,
      item.admin,
      ...item.positions.map((position) => position.positionTitle ?? position.title),
    ]
      .join(' ')
      .toLowerCase();

    const matchesSearch = !normalizedQuery || haystack.includes(normalizedQuery);
    const matchesOwner =
      !mineOnly ||
      (normalizedWallets.size > 0 && normalizedWallets.has(normalizeAddress(item.admin)));

    return matchesSearch && matchesOwner;
  });
}

export function getElectionListStats(items: ElectionV1GroupListItem[]): ElectionListStats {
  return items.reduce<ElectionListStats>(
    (acc, item) => {
      const phase = getPhaseLabel(item);
      acc.total++;
      if (phase === 'Chờ bắt đầu') acc.pending++;
      else if (phase === 'Đang bỏ phiếu') acc.commit++;
      else if (phase === 'Kiểm phiếu') acc.reveal++;
      else acc.ended++;
      return acc;
    },
    { total: 0, pending: 0, commit: 0, reveal: 0, ended: 0 },
  );
}

export function getElectionGroupMilestone(
  item: ElectionV1GroupListItem,
  nowSeconds = Math.floor(Date.now() / 1000),
): ElectionGroupMilestone {
  if (nowSeconds < item.commitStart) {
    return { label: 'Mở nhận phiếu', timestamp: item.commitStart };
  }

  if (nowSeconds < item.commitEnd) {
    return { label: 'Hạn nhận phiếu', timestamp: item.commitEnd };
  }

  if (nowSeconds < item.revealEnd) {
    return { label: 'Hạn kiểm phiếu', timestamp: item.revealEnd };
  }

  return { label: 'Đã kết thúc', timestamp: item.revealEnd };
}

export function describePositionCount(count: number): string {
  return count === 1 ? '1 chức vụ' : `${count} chức vụ`;
}

export function describeVoterCount(count: number): string {
  return count === 1 ? '1 cử tri' : `${count} cử tri`;
}

export function describeGroupPositions(item: ElectionV1GroupListItem): string {
  const titles = item.positions
    .map((position) => position.positionTitle ?? position.title)
    .filter(Boolean);

  if (titles.length === 0) {
    return describePositionCount(item.positionCount);
  }

  if (titles.length <= 2) {
    return titles.join(', ');
  }

  return `${titles.slice(0, 2).join(', ')} và ${titles.length - 2} chức vụ khác`;
}

export function getElectionListLoadMessage(count: number): string {
  return count === 1 ? 'Đã tải 1 đợt bầu cử.' : `Đã tải ${count} đợt bầu cử.`;
}
