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
  viewerRole?: 'owner' | 'voter' | 'observer' | 'unknown' | string;
  viewerEligiblePositionCount?: number;
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

export interface ElectionV1RosterVoterInput {
  fullName: string;
  email: string;
  studentCode?: string | null;
}

export interface ElectionV1CreateRosterDraftRequest {
  adminWalletAddress: string;
  title: string;
  description?: string | null;
  groupKey?: string | null;
  commitStart: string;
  commitEnd: string;
  revealEnd: string;
  positions: ElectionV1CreatePositionRequest[];
  voters: ElectionV1RosterVoterInput[];
}

export interface ElectionV1RosterInvite {
  inviteId: string;
  fullName: string;
  email: string;
  studentCode?: string | null;
  inviteUrl: string;
  qrPayload: string;
  otpVerified: boolean;
  walletAddress?: string | null;
  claimedByUserId?: number | null;
  walletBoundAt?: string | null;
}

export interface ElectionV1RosterDraftPosition {
  positionId: string;
  title: string;
  description?: string | null;
  ballotOrder: number;
  candidates: ElectionV1Candidate[];
}

export interface ElectionV1RosterDeployment {
  deployedAt: string;
  includedVoterCount: number;
  groupKey: string;
  created: ElectionV1CreateResult[];
}

export interface ElectionV1RosterDraft {
  groupKey: string;
  sharedInviteUrl?: string | null;
  title: string;
  description?: string | null;
  adminWalletAddress: string;
  commitStart: string;
  commitEnd: string;
  revealEnd: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  totalInviteCount: number;
  otpVerifiedCount: number;
  walletBoundCount: number;
  includedVoterCount: number;
  positions: ElectionV1RosterDraftPosition[];
  invites: ElectionV1RosterInvite[];
  deployment?: ElectionV1RosterDeployment | null;
}

export interface ElectionV1CreateRosterDraftResponse {
  message: string;
  draft: ElectionV1RosterDraft;
}

export interface ElectionV1RosterInvitePosition {
  positionId: string;
  title: string;
  description?: string | null;
  candidateNames: string[];
}

export interface ElectionV1RosterInviteResolve {
  groupKey: string;
  ballotTitle: string;
  ballotDescription?: string | null;
  inviteId: string;
  fullName: string;
  emailMasked: string;
  studentCode?: string | null;
  commitStart: string;
  commitEnd: string;
  revealEnd: string;
  positions: ElectionV1RosterInvitePosition[];
  otpVerified: boolean;
  walletBound: boolean;
  walletAddress?: string | null;
  status: string;
  groupDeployed: boolean;
  inviteUrl: string;
}

export interface ElectionV1RosterPublicInvite {
  groupKey: string;
  ballotTitle: string;
  ballotDescription?: string | null;
  commitStart: string;
  commitEnd: string;
  revealEnd: string;
  positions: ElectionV1RosterInvitePosition[];
  status: string;
  groupDeployed: boolean;
  sharedInviteUrl: string;
  totalInviteCount: number;
  otpVerifiedCount: number;
  walletBoundCount: number;
}

export interface ElectionV1OtpDispatchResponse {
  message: string;
  deliveryMode: string;
  emailMasked: string;
  expiresAt?: string | null;
  devOtpCode?: string | null;
  inviteToken?: string | null;
  inviteId?: string | null;
}

export interface ElectionV1OtpVerifyResponse {
  message: string;
  otpVerified: boolean;
}

export interface ElectionV1PrepareWalletBindingResponse {
  walletAddress: string;
  message: string;
}

export interface ElectionV1BindWalletResponse {
  message: string;
  groupKey: string;
  inviteId: string;
  walletAddress: string;
  claimedByUserId: number;
}

export interface ElectionV1DeployRosterDraftResponse {
  message: string;
  created: {
    message: string;
    groupKey: string;
    includedVoterCount: number;
    created: ElectionV1CreateResult[];
  };
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
        viewerRole: 'unknown',
        viewerEligiblePositionCount: 0,
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

export async function listElectionV1Groups(viewerAddress?: string | null) {
  try {
    const response = await apiClient.get<{ items: ElectionV1GroupListItem[] }>(
      '/api/election-v1/election-groups',
      {
        params: viewerAddress ? { viewerAddress } : undefined,
      },
    );
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

export async function getElectionV1GroupDetail(identifier: string, viewerAddress?: string | null) {
  try {
    const response = await apiClient.get<ElectionV1GroupDetail>(
      `/api/election-v1/election-groups/${encodeURIComponent(identifier)}`,
      {
        params: viewerAddress ? { viewerAddress } : undefined,
      },
    );
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

export async function createElectionV1RosterDraft(payload: ElectionV1CreateRosterDraftRequest) {
  const response = await apiClient.post<ElectionV1CreateRosterDraftResponse>('/api/election-v1/roster-drafts', payload);
  return response.data;
}

export async function getElectionV1RosterDraft(groupKey: string) {
  const response = await apiClient.get<ElectionV1RosterDraft>(`/api/election-v1/roster-drafts/${encodeURIComponent(groupKey)}`);
  return response.data;
}

export async function deployElectionV1RosterDraft(groupKey: string) {
  const response = await apiClient.post<ElectionV1DeployRosterDraftResponse>(
    `/api/election-v1/roster-drafts/${encodeURIComponent(groupKey)}/deploy`,
    {},
  );
  return response.data;
}

export async function resolveElectionV1VoterInvite(token: string) {
  const response = await apiClient.get<ElectionV1RosterInviteResolve>('/api/election-v1/voter-invites/resolve', {
    params: { token },
  });
  return response.data;
}

export async function resolveElectionV1VoterInviteGroup(groupKey: string) {
  const response = await apiClient.get<ElectionV1RosterPublicInvite>(
    `/api/election-v1/voter-invites/groups/${encodeURIComponent(groupKey)}`,
  );
  return response.data;
}

export async function sendElectionV1InviteOtp(token: string) {
  const response = await apiClient.post<ElectionV1OtpDispatchResponse>(
    `/api/election-v1/voter-invites/${encodeURIComponent(token)}/send-otp`,
    {},
  );
  return response.data;
}

export async function sendElectionV1InviteOtpByIdentity(
  groupKey: string,
  payload: { email: string; studentCode?: string | null },
) {
  const response = await apiClient.post<ElectionV1OtpDispatchResponse>(
    `/api/election-v1/voter-invites/groups/${encodeURIComponent(groupKey)}/send-otp`,
    payload,
  );
  return response.data;
}

export async function verifyElectionV1InviteOtp(token: string, otp: string) {
  const response = await apiClient.post<ElectionV1OtpVerifyResponse>(
    `/api/election-v1/voter-invites/${encodeURIComponent(token)}/verify-otp`,
    { otp },
  );
  return response.data;
}

export async function prepareElectionV1WalletBinding(token: string, walletAddress: string) {
  const response = await apiClient.post<ElectionV1PrepareWalletBindingResponse>(
    `/api/election-v1/voter-invites/${encodeURIComponent(token)}/prepare-wallet-bind`,
    { walletAddress },
  );
  return response.data;
}

export async function bindElectionV1InviteWallet(token: string, walletAddress: string, signature: string) {
  const response = await apiClient.post<ElectionV1BindWalletResponse>(
    `/api/election-v1/voter-invites/${encodeURIComponent(token)}/bind-wallet`,
    { walletAddress, signature },
  );
  return response.data;
}
