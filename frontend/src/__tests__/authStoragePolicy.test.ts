import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const sourceRoot = join(__dirname, '..');
const forbiddenPatterns = [
  /localStorage\.setItem\(\s*['"]accessToken['"]/,
  /localStorage\.getItem\(\s*['"]accessToken['"]/,
  /window\.localStorage\.getItem\(\s*['"]accessToken['"]/,
];

const collectSourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const fullPath = join(directory, name);
    if (fullPath.includes(`${join('src', '__tests__')}`)) {
      return [];
    }

    if (statSync(fullPath).isDirectory()) {
      return collectSourceFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(name) ? [fullPath] : [];
  });

describe('auth storage policy', () => {
  test('does not persist or restore access tokens from browser storage', () => {
    const offenders = collectSourceFiles(sourceRoot).flatMap((filePath) => {
      const content = readFileSync(filePath, 'utf8');
      return forbiddenPatterns.some((pattern) => pattern.test(content)) ? [filePath] : [];
    });

    expect(offenders).toEqual([]);
  });
});
