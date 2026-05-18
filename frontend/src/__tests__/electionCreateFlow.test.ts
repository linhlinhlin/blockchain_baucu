import {
  buildCreateFlowRequirements,
  getDuplicateWalletEntries,
  getFirstInvalidRequirement,
  getInvalidRosterRows,
  getInvalidWalletEntries,
  getScheduleState,
  isValidEthereumAddress,
  normalizePositions,
  parseRosterEntries,
  shortenAddress,
  slugify,
  splitWalletEntries,
} from '../utils/electionCreateFlow';

const validWalletA = '0xea6e374d6ccaa2223e9bab43022a4a4a5e123456';
const validWalletB = '0x1111111111111111111111111111111111111111';

describe('electionCreateFlow utilities', () => {
  test('splits wallet entries and validates Ethereum address format', () => {
    const entries = splitWalletEntries(`${validWalletA},\n${validWalletB}; invalid`);

    expect(entries).toEqual([validWalletA, validWalletB, 'invalid']);
    expect(isValidEthereumAddress(validWalletA)).toBe(true);
    expect(getInvalidWalletEntries(entries)).toEqual(['invalid']);
  });

  test('detects duplicate wallets case-insensitively', () => {
    expect(getDuplicateWalletEntries([validWalletA, validWalletA.toUpperCase()])).toEqual([
      validWalletA.toUpperCase(),
    ]);
  });

  test('parses roster rows and returns invalid row numbers', () => {
    const rows = parseRosterEntries('Nguyen Van A,a@example.com,SV01\nMissing Email,,SV02\n,b@example.com,SV03');

    expect(rows).toHaveLength(3);
    expect(getInvalidRosterRows(rows).map((row) => row.rowNumber)).toEqual([2, 3]);
  });

  test('normalizes Vietnamese labels into stable source ids', () => {
    const positions = normalizePositions([
      {
        id: 'position-1',
        title: 'Lớp trưởng',
        description: '',
        candidates: [
          { id: 'candidate-1', displayName: 'Nguyễn Văn A', walletAddress: '' },
          { id: 'candidate-2', displayName: 'Trần Thị B', walletAddress: '' },
        ],
      },
    ]);

    expect(slugify('Lớp trưởng')).toBe('lop-truong');
    expect(positions[0].positionId).toBe('position:lop-truong:1');
    expect(positions[0].candidates[0].sourceId).toBe('candidate:nguyen-van-a:1');
  });

  test('requires schedule ordering and future start time', () => {
    const now = Date.parse('2026-05-01T08:00:00');

    expect(
      getScheduleState('2026-05-01T09:00', '2026-05-01T10:00', '2026-05-01T11:00', now).isValid,
    ).toBe(true);
    expect(
      getScheduleState('2026-05-01T07:00', '2026-05-01T10:00', '2026-05-01T11:00', now).isValid,
    ).toBe(false);
    expect(
      getScheduleState('2026-05-01T09:00', '2026-05-01T08:30', '2026-05-01T11:00', now).isValid,
    ).toBe(false);
  });

  test('builds requirements and finds first invalid blocker', () => {
    const requirements = buildCreateFlowRequirements({
      accessToken: 'token',
      currentAccount: validWalletA,
      isNetworkConnected: true,
      voterMode: 'wallets',
      title: '',
      scheduleIsValid: true,
      positions: [],
      invalidCandidateWalletCount: 0,
      voterWalletCount: 0,
      invalidVoterWalletCount: 0,
      duplicateVoterWalletCount: 0,
      rosterVoterCount: 0,
      invalidRosterRowCount: 0,
    });

    expect(getFirstInvalidRequirement(requirements)?.id).toBe('title');
  });

  test('shortens long wallet addresses without losing both ends', () => {
    expect(shortenAddress(validWalletA)).toBe('0xea6e…3456');
  });
});
