import {
  buildVerifyTransactionPath,
  extractVerifyTransactionTarget,
  isTransactionHash,
} from '../utils/transactionVerification';

const txHash = '0x79fcd6f3ca1a9e48464e74d2cfc5e79a52b6d891dd580d5b91c3912d061ca6b8';

describe('transaction verification links', () => {
  test('builds a public app verification path', () => {
    expect(buildVerifyTransactionPath(txHash, 11155111)).toBe(`/verify-tx?chain=11155111&tx=${txHash}`);
  });

  test('recognizes valid transaction hashes only', () => {
    expect(isTransactionHash(txHash)).toBe(true);
    expect(isTransactionHash('0x1234')).toBe(false);
    expect(isTransactionHash('not-a-tx')).toBe(false);
  });

  test('extracts targets from internal verification URLs', () => {
    const target = extractVerifyTransactionTarget(new URL(`http://localhost:3000/verify-tx?chain=11155111&tx=${txHash}`));

    expect(target).toEqual({ txHash, chainId: 11155111 });
  });

  test('extracts targets from Sepolia Etherscan URLs', () => {
    const target = extractVerifyTransactionTarget(new URL(`https://sepolia.etherscan.io/tx/${txHash}`));

    expect(target).toEqual({ txHash, chainId: 11155111 });
  });

  test('does not silently treat mainnet Etherscan as Sepolia', () => {
    const target = extractVerifyTransactionTarget(new URL(`https://etherscan.io/tx/${txHash}`));

    expect(target).toEqual({ txHash, chainId: 1 });
  });

  test('rejects unrelated URLs', () => {
    expect(extractVerifyTransactionTarget(new URL('https://example.com/tx/not-real'))).toBeNull();
  });
});
