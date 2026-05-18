export type RosterMode = 'wallets' | 'roster';

export type CandidateDraft = {
  id: string;
  displayName: string;
  walletAddress: string;
};

export type PositionDraft = {
  id: string;
  title: string;
  description: string;
  candidates: CandidateDraft[];
};

export type RosterVoterDraft = {
  id: string;
  fullName: string;
  email: string;
  studentCode: string;
  rowNumber: number;
};

export type NormalizedPosition = PositionDraft & {
  title: string;
  description: string;
  positionId: string;
  candidates: Array<
    CandidateDraft & {
      displayName: string;
      walletAddress: string;
      sourceId: string;
    }
  >;
};

export type Requirement = {
  id: string;
  label: string;
  ok: boolean;
  targetId?: string;
};

export function toDateTimeLocalValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function splitWalletEntries(value: string) {
  return value
    .split(/[\s,;\n\r]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseRosterEntries(value: string): RosterVoterDraft[] {
  return value
    .split(/\r?\n/)
    .map((line, index) => {
      const [fullName = '', email = '', studentCode = ''] = line
        .split(',')
        .map((item) => item.trim());
      return {
        id: `roster-${index + 1}`,
        fullName,
        email,
        studentCode,
        rowNumber: index + 1,
      };
    })
    .filter((item) => item.fullName.length > 0 || item.email.length > 0 || item.studentCode.length > 0);
}

export function isValidEthereumAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function getInvalidWalletEntries(values: string[]) {
  return values.filter((value) => !isValidEthereumAddress(value));
}

export function getDuplicateWalletEntries(values: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      continue;
    }

    if (seen.has(normalized)) {
      duplicates.add(value.trim());
      continue;
    }

    seen.add(normalized);
  }

  return Array.from(duplicates);
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function getInvalidRosterRows(values: RosterVoterDraft[]) {
  return values.filter((item) => item.fullName.trim().length === 0 || !isValidEmail(item.email));
}

export function slugify(value: string) {
  const normalized = value
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return normalized || 'item';
}

export function createCandidateDraft(index: number): CandidateDraft {
  return {
    id: `candidate-${Date.now()}-${Math.random()}-${index}`,
    displayName: '',
    walletAddress: '',
  };
}

export function createPositionDraft(index: number): PositionDraft {
  return {
    id: `position-${Date.now()}-${Math.random()}-${index}`,
    title: '',
    description: '',
    candidates: [createCandidateDraft(1), createCandidateDraft(2)],
  };
}

export function normalizePositions(values: PositionDraft[]): NormalizedPosition[] {
  return values
    .map((position, positionIndex) => ({
      ...position,
      title: position.title.trim(),
      description: position.description.trim(),
      candidates: position.candidates
        .map((candidate, candidateIndex) => ({
          ...candidate,
          displayName: candidate.displayName.trim(),
          walletAddress: candidate.walletAddress.trim(),
          sourceId: `candidate:${slugify(candidate.displayName || `candidate-${candidateIndex + 1}`)}:${candidateIndex + 1}`,
        }))
        .filter((candidate) => candidate.displayName.length > 0),
      positionId: `position:${slugify(position.title || `position-${positionIndex + 1}`)}:${positionIndex + 1}`,
    }))
    .filter((position) => position.title.length > 0);
}

export function getInvalidCandidateWallets(values: NormalizedPosition[]) {
  return values.flatMap((position) =>
    position.candidates
      .filter((candidate) => candidate.walletAddress.length > 0 && !isValidEthereumAddress(candidate.walletAddress))
      .map((candidate) => ({
        positionTitle: position.title,
        candidateName: candidate.displayName,
        walletAddress: candidate.walletAddress,
      })),
  );
}

export function getScheduleState(commitStart: string, commitEnd: string, revealEnd: string, now = Date.now()) {
  const commitStartValue = Date.parse(commitStart);
  const commitEndValue = Date.parse(commitEnd);
  const revealEndValue = Date.parse(revealEnd);
  const hasAllDates =
    !Number.isNaN(commitStartValue) &&
    !Number.isNaN(commitEndValue) &&
    !Number.isNaN(revealEndValue);

  return {
    hasAllDates,
    startsInFuture: hasAllDates && commitStartValue > now,
    isOrdered: hasAllDates && commitStartValue < commitEndValue && commitEndValue < revealEndValue,
    isValid: hasAllDates && commitStartValue > now && commitStartValue < commitEndValue && commitEndValue < revealEndValue,
  };
}

export function shortenAddress(value?: string | null) {
  if (!value) {
    return 'n/a';
  }

  const trimmed = value.trim();
  if (trimmed.length <= 14) {
    return trimmed;
  }

  return `${trimmed.slice(0, 6)}…${trimmed.slice(-4)}`;
}

export function buildCreateFlowRequirements(input: {
  accessToken?: string | null;
  currentAccount?: string | null;
  isNetworkConnected: boolean;
  voterMode: RosterMode;
  title: string;
  scheduleIsValid: boolean;
  positions: NormalizedPosition[];
  invalidCandidateWalletCount: number;
  voterWalletCount: number;
  invalidVoterWalletCount: number;
  duplicateVoterWalletCount: number;
  rosterVoterCount: number;
  invalidRosterRowCount: number;
}): Requirement[] {
  return [
    {
      id: 'jwt',
      label: 'JWT hợp lệ',
      ok: Boolean(input.accessToken),
    },
    {
      id: 'wallet',
      label: 'MetaMask đã kết nối',
      ok: Boolean(input.currentAccount),
      targetId: 'connect-wallet-button',
    },
    ...(input.voterMode === 'wallets'
      ? [
          {
            id: 'network',
            label: 'Mạng Sepolia',
            ok: input.isNetworkConnected,
            targetId: 'connect-wallet-button',
          },
        ]
      : []),
    {
      id: 'title',
      label: 'Tên cuộc bầu cử',
      ok: input.title.trim().length > 0,
      targetId: 'ballot-title',
    },
    {
      id: 'schedule',
      label: 'Lịch hợp lệ: start < end < reveal và start ở tương lai',
      ok: input.scheduleIsValid,
      targetId: 'commit-start',
    },
    {
      id: 'positions',
      label: 'Ít nhất 1 chức vụ, mỗi chức vụ có từ 2 ứng viên',
      ok: input.positions.length > 0 && input.positions.every((position) => position.candidates.length >= 2),
      targetId: 'positions-section',
    },
    {
      id: 'candidate-wallets',
      label: 'Ví ứng viên hợp lệ nếu được nhập',
      ok: input.invalidCandidateWalletCount === 0,
      targetId: 'positions-section',
    },
    ...(input.voterMode === 'wallets'
      ? [
          {
            id: 'voter-wallets',
            label: `Cử tri (${input.voterWalletCount})`,
            ok: input.voterWalletCount > 0,
            targetId: 'voter-wallets-input',
          },
          {
            id: 'voter-wallet-format',
            label: 'Địa chỉ ví cử tri đúng định dạng 0x…40 ký tự',
            ok: input.invalidVoterWalletCount === 0,
            targetId: 'voter-wallets-input',
          },
          {
            id: 'voter-wallet-duplicates',
            label: 'Không trùng địa chỉ ví cử tri',
            ok: input.duplicateVoterWalletCount === 0,
            targetId: 'voter-wallets-input',
          },
        ]
      : [
          {
            id: 'roster',
            label: `Roster (${input.rosterVoterCount} dòng)`,
            ok: input.rosterVoterCount > 0,
            targetId: 'roster-input',
          },
          {
            id: 'roster-format',
            label: 'Mỗi dòng roster có họ tên và email hợp lệ',
            ok: input.invalidRosterRowCount === 0,
            targetId: 'roster-input',
          },
        ]),
  ];
}

export function getFirstInvalidRequirement(requirements: Requirement[]) {
  return requirements.find((requirement) => !requirement.ok) ?? null;
}
