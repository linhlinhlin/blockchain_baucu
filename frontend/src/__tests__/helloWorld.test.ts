import { helloWorld } from '../helloWorld';

test('returns the greeting copy used by the app smoke test', () => {
  expect(helloWorld()).toBe('Hello, world!');
});
