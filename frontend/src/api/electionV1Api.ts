import apiClient from './apiClient';

export interface ElectionV1Links {
  contract?: string | null;
  transaction?: string | null;
}

export interface ElectionV1Candidate {
  candidateId: string;
  displayName: string;
  sourceId?: string | null;
  walletAddress?: string | null;
}

export interface ElectionV1Result {
  candidateIndex: number;
  candidateId: string;
  candidateName: string;
  candidateSourceId?: string | null;
  candidateWalletAddress?: string | null;
  count: number;
}

export interface ElectionV1ViewerState {
  address: string;
  eligible: boolean;
  hasCommitted: boolean;
  hasRevealed: boolean;
  commitment?: string | null;
  proofAvailable: boolean;
}

export interface ElectionV1OnChainState {
  address: string;
  owner: string;
  phase: number;
  phaseLabel: string;
  finalized: boolean;
  canceled: boolean;
  commitStart: number;
  commitEnd: number;
  revealEnd: number;
  totalCommits: string;
  totalReveals: string;
  results: ElectionV1Result[];
  viewer?: ElectionV1ViewerState | null;
}

export interface ElectionV1ListItem {
  address: string;
  admin: string;
  ballotOrder?: number;
  title: string;
  description: string;
  electionKey?: string | null;
  groupKey?: string | null;
  groupTitle?: string | null;
  positionId?: string | null;
  positionTitle?: string | null;
  commitStart: number;
  commitEnd: number;
  revealEnd: number;
  voterCount: number;
  candidates: ElectionV1Candidate[];
  blockNumber: number;
  txHash: string;
  createdAt?: string | null;
  links?: ElectionV1Links | null;
}

export interface ElectionV1Detail extends ElectionV1ListItem {
  manifest?: Record<string, unknown> | null;
  summary?: Record<string, unknown> | null;
  onChain?: ElectionV1OnChainState | null;
}

export interface ElectionV1GroupListItem {
  groupKey: string;
  title: string;
  description: string;
  admin: string;
  commitStart: number;
  commitEnd: number;
  revealEnd: number;
  voterCount: number;
  positionCount: number;
  blockNumber: number;
  createdAt?: string | null;
  positions: ElectionV1ListItem[];
}

export interface ElectionV1GroupDetail extends ElectionV1GroupListItem {}

export interface ElectionV1PublicConfig {
  chainId: number;
  explorerBaseUrl?: string | null;
  factoryAddress?: string | null;
  rpcUrl?: string | null;
}

export interface ElectionV1Proof {
  address: string;
  eligible: boolean;
  proof: string[];
}

export interface ElectionV1CreateCandidateRequest {
  displayName: string;
  sourceId?: string | null;
  walletAddress?: string | null;
}

export interface ElectionV1CreateRequest {
  adminWalletAddress: string;
  title: string;
  description?: string | null;
  electionKey?: string | null;
  commitStart: string;
  commitEnd: string;
  revealEnd: string;
  candidates: ElectionV1CreateCandidateRequest[];
  voterWalletAddresses: string[];
}

export interface ElectionV1CreatePositionRequest {
  positionId?: string | null;
  title: string;
  description?: string | null;
  candidates: ElectionV1CreateCandidateRequest[];
}

export interface ElectionV1CreateGroupRequest {
  adminWalletAddress: string;
  title: string;
  description?: string | null;
  groupKey?: string | null;
  commitStart: string;
  commitEnd: string;
  revealEnd: string;
  positions: ElectionV1CreatePositionRequest[];
  voterWalletAddresses: string[];
}

export interface ElectionV1CreateResult {
  address: string;
  electionId: string;
  txHash: string;
  latestPath?: string | null;
  snapshotPath?: string | null;
  outputDirectory?: string | null;
}

export interface ElectionV1CreateResponse {
  message: string;
  created: ElectionV1CreateResult;
  detail?: ElectionV1Detail | null;
}

export interface ElectionV1CreateGroupResult {
  groupKey: string;
  created: ElectionV1CreateResult[];
}

export interface ElectionV1CreateGroupResponse {
  message: string;
  created: ElectionV1CreateGroupResult;
  detail?: ElectionV1GroupDetail | null;
}

function isNotFoundError(error: unknown) {
  return (error as any)?.response?.status === 404;
}

function buildFallbackGroupKey(item: ElectionV1ListItem) {
  if (item.groupKey) {
    return item.groupKey;
  }

  const electionKey = item.electionKey?.trim();
  if (electionKey) {
    const marker = ':position:';
    const index = electionKey.indexOf(marker);
    if (index >= 0) {
      return electionKey.slice(0, index);
    }

    return electionKey;
  }

  return item.address;
}

function buildFallbackGroupTitle(item: ElectionV1ListItem) {
  if (item.groupTitle) {
    return item.groupTitle;
  }

  const parts = item.title.split(' :: ');
  return parts.length > 1 ? parts[0].trim() : item.title;
}

function buildFallbackPositionTitle(item: ElectionV1ListItem) {
  if (item.positionTitle) {
    return item.positionTitle;
  }

  const parts = item.title.split(' :: ');
  return parts.length > 1 ? parts.slice(1).join(' :: ').trim() : item.title;
}

export function synthesizeElectionGroups(items: ElectionV1ListItem[]): ElectionV1GroupListItem[] {
  const groups = new Map<string, ElectionV1ListItem[]>();
  for (const item of items) {
    const groupKey = buildFallbackGroupKey(item);
    const nextItem: ElectionV1ListItem = {
      ...item,
      groupKey,
      groupTitle: buildFallbackGroupTitle(item),
      positionTitle: buildFallbackPositionTitle(item),
      ballotOrder: item.ballotOrder ?? 0,
    };

    const current = groups.get(groupKey) ?? [];
    current.push(nextItem);
    groups.set(groupKey, current);
  }

  return Array.from(groups.entries())
    .map(([groupKey, positions]) => {
      const ordered = [...positions].sort((a, b) => (a.ballotOrder ?? 0) - (b.ballotOrder ?? 0) || a.title.localeCompare(b.title));
      const first = ordered[0];
      return {
        groupKey,
        title: first.groupTitle ?? buildFallbackGroupTitle(first),
        description: first.description,
        admin: first.admin,
        commitStart: Math.min(...ordered.map((item) => item.commitStart)),
        commitEnd: Math.max(...ordered.map((item) => item.commitEnd)),
        revealEnd: Math.max(...ordered.map((item) => item.revealEnd)),
        voterCount: Math.max(...ordered.map((item) => item.voterCount)),
        positionCount: ordered.length,
        blockNumber: Math.max(...ordered.map((item) => item.blockNumber)),
        createdAt: [...ordered].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))[0]?.createdAt ?? null,
        positions: ordered,
      } satisfies ElectionV1GroupListItem;
    })
    .sort((a, b) => b.blockNumber - a.blockNumber);
}

export async function getElectionV1PublicConfig() {
  const response = await apiClient.get<ElectionV1PublicConfig>('/api/election-v1/public-config');
  return response.data;
}

export async function listElectionV1() {
  const response = await apiClient.get<{ items: ElectionV1ListItem[] }>('/api/election-v1/elections');
  return response.data.items ?? [];
}

export async function listElectionV1Groups() {
  try {
    const response = await apiClient.get<{ items: ElectionV1GroupListItem[] }>('/api/election-v1/election-groups');
    return response.data.items ?? [];
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    const items = await listElectionV1();
    return synthesizeElectionGroups(items);
  }
}

export async function getElectionV1Detail(identifier: string, viewerAddress?: string | null) {
  const response = await apiClient.get<ElectionV1Detail>(`/api/election-v1/elections/${identifier}`, {
    params: viewerAddress ? { viewerAddress } : undefined,
  });
  return response.data;
}

export async function getElectionV1GroupDetail(identifier: string) {
  try {
    const response = await apiClient.get<ElectionV1GroupDetail>(`/api/election-v1/election-groups/${identifier}`);
    return response.data;
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    const groups = await listElectionV1Groups();
    const group = groups.find(
      (item) =>
        item.groupKey.toLowerCase() === identifier.toLowerCase() ||
        item.title.toLowerCase() === identifier.toLowerCase(),
    );

    if (!group) {
      throw error;
    }

    return group;
  }
}

export async function getElectionV1Proof(identifier: string, address: string) {
  const response = await apiClient.get<ElectionV1Proof>(`/api/election-v1/elections/${identifier}/proof`, {
    params: { address },
  });
  return response.data;
}

export async function createElectionV1(payload: ElectionV1CreateRequest) {
  const response = await apiClient.post<ElectionV1CreateResponse>('/api/election-v1/elections', payload);
  return response.data;
}

export async function createElectionV1Group(payload: ElectionV1CreateGroupRequest) {
  try {
    const response = await apiClient.post<ElectionV1CreateGroupResponse>('/api/election-v1/election-groups', payload);
    return response.data;
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }

    const fallbackGroupKey = payload.groupKey?.trim() || `group-${Date.now()}`;
    const created: ElectionV1CreateResult[] = [];
    const detailPositions: ElectionV1ListItem[] = [];

    for (let index = 0; index < payload.positions.length; index += 1) {
      const position = payload.positions[index];
      const singlePayload: ElectionV1CreateRequest = {
        adminWalletAddress: payload.adminWalletAddress,
        title: `${payload.title} :: ${position.title}`,
        description: position.description ?? payload.description ?? null,
        electionKey: `${fallbackGroupKey}:position:${index + 1}`,
        commitStart: payload.commitStart,
        commitEnd: payload.commitEnd,
        revealEnd: payload.revealEnd,
        voterWalletAddresses: payload.voterWalletAddresses,
        candidates: position.candidates,
      };

      const singleResponse = await createElectionV1(singlePayload);
      created.push(singleResponse.created);
      if (singleResponse.detail) {
        detailPositions.push({
          ...singleResponse.detail,
          groupKey: fallbackGroupKey,
          groupTitle: payload.title,
          positionId: position.positionId ?? `position:${index + 1}`,
          positionTitle: position.title,
          ballotOrder: index + 1,
        });
      }
    }

    const positions = detailPositions.sort((a, b) => (a.ballotOrder ?? 0) - (b.ballotOrder ?? 0));
    const first = positions[0];

    return {
      message: 'Tao nhom election thanh cong tren fallback client path.',
      created: {
        groupKey: fallbackGroupKey,
        created,
      },
      detail: first
        ? {
            groupKey: fallbackGroupKey,
            title: payload.title,
            description: payload.description ?? '',
            admin: payload.adminWalletAddress,
            commitStart: first.commitStart,
            commitEnd: first.commitEnd,
            revealEnd: first.revealEnd,
            voterCount: first.voterCount,
            positionCount: positions.length,
            blockNumber: Math.max(...positions.map((item) => item.blockNumber)),
            createdAt: positions[0]?.createdAt ?? null,
            positions,
          }
        : null,
    };
  }
}
