import type { ElectionV1GroupListItem } from '../api/electionV1Api';
import {
  describeGroupPositions,
  filterElectionGroups,
  getElectionGroupMilestone,
  getElectionListLoadMessage,
  getElectionListStats,
} from '../utils/electionListPresentation';

const adminA = '0xea6e374d6ccaa2223e9bab43022a4a4a5e123456';
const adminB = '0x1111111111111111111111111111111111111111';

function makeGroup(overrides: Partial<ElectionV1GroupListItem>): ElectionV1GroupListItem {
  return {
    groupKey: 'bau-cu-lop',
    title: 'Bầu cử lớp',
    description: 'Chọn ban cán sự',
    admin: adminA,
    commitStart: 100,
    commitEnd: 200,
    revealEnd: 300,
    voterCount: 12,
    positionCount: 2,
    blockNumber: 1,
    positions: [
      {
        address: '0x2222222222222222222222222222222222222222',
        admin: adminA,
        title: 'Bầu cử lớp :: Lớp trưởng',
        description: 'Chọn lớp trưởng',
        positionTitle: 'Lớp trưởng',
        commitStart: 100,
        commitEnd: 200,
        revealEnd: 300,
        voterCount: 12,
        candidates: [],
        blockNumber: 1,
        txHash: '0xabc',
      },
      {
        address: '0x3333333333333333333333333333333333333333',
        admin: adminA,
        title: 'Bầu cử lớp :: Bí thư',
        description: 'Chọn bí thư',
        positionTitle: 'Bí thư',
        commitStart: 100,
        commitEnd: 200,
        revealEnd: 300,
        voterCount: 12,
        candidates: [],
        blockNumber: 1,
        txHash: '0xdef',
      },
    ],
    ...overrides,
  };
}

describe('election list presentation', () => {
  test('filters owned elections only when a known wallet is available', () => {
    const items = [makeGroup({ admin: adminA }), makeGroup({ groupKey: 'khac', admin: adminB })];

    expect(filterElectionGroups(items, '', true, new Set())).toEqual([]);
    expect(filterElectionGroups(items, '', true, new Set([adminA.toUpperCase()]))).toHaveLength(1);
  });

  test('searches by election text and position titles', () => {
    const items = [
      makeGroup({}),
      makeGroup({
        groupKey: 'hoi-dong',
        title: 'Hội đồng',
        positions: [
          {
            address: '0x4444444444444444444444444444444444444444',
            admin: adminB,
            title: 'Hội đồng :: Chủ tịch',
            description: 'Chọn chủ tịch',
            positionTitle: 'Chủ tịch',
            commitStart: 100,
            commitEnd: 200,
            revealEnd: 300,
            voterCount: 12,
            candidates: [],
            blockNumber: 1,
            txHash: '0xaaa',
          },
        ],
      }),
    ];

    expect(filterElectionGroups(items, 'bí thư', false, new Set()).map((item) => item.groupKey)).toEqual([
      'bau-cu-lop',
    ]);
    expect(filterElectionGroups(items, 'hoi-dong', false, new Set()).map((item) => item.groupKey)).toEqual([
      'hoi-dong',
    ]);
  });

  test('builds user-facing stats and milestone labels', () => {
    const items = [
      makeGroup({ groupKey: 'pending', commitStart: 200, commitEnd: 300, revealEnd: 400 }),
      makeGroup({ groupKey: 'commit', commitStart: 50, commitEnd: 200, revealEnd: 300 }),
      makeGroup({ groupKey: 'reveal', commitStart: 10, commitEnd: 50, revealEnd: 200 }),
      makeGroup({ groupKey: 'ended', commitStart: 10, commitEnd: 20, revealEnd: 30 }),
    ];

    const dateNow = jest.spyOn(Date, 'now').mockReturnValue(100_000);
    expect(getElectionListStats(items)).toEqual({ total: 4, pending: 1, commit: 1, reveal: 1, ended: 1 });
    dateNow.mockRestore();

    expect(getElectionGroupMilestone(items[0], 100)).toEqual({ label: 'Mở nhận phiếu', timestamp: 200 });
    expect(getElectionGroupMilestone(items[1], 100)).toEqual({ label: 'Hạn nhận phiếu', timestamp: 200 });
    expect(getElectionGroupMilestone(items[2], 100)).toEqual({ label: 'Hạn kiểm phiếu', timestamp: 200 });
    expect(getElectionGroupMilestone(items[3], 100)).toEqual({ label: 'Đã kết thúc', timestamp: 30 });
  });

  test('describes positions and load count in Vietnamese', () => {
    expect(describeGroupPositions(makeGroup({}))).toBe('Lớp trưởng, Bí thư');
    expect(getElectionListLoadMessage(1)).toBe('Đã tải 1 đợt bầu cử.');
    expect(getElectionListLoadMessage(3)).toBe('Đã tải 3 đợt bầu cử.');
  });
});
