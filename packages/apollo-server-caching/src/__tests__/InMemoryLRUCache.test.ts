import {
  testKeyValueCache_Basics,
  testKeyValueCache_Expiration,
} from '../../../apollo-server-caching/src/__tests__/testsuite';
import { InMemoryLRUCache } from '../InMemoryLRUCache';

describe('InMemoryLRUCache', () => {
  describe('general tests', () => {
    const cache = new InMemoryLRUCache();
    testKeyValueCache_Basics(cache);
    testKeyValueCache_Expiration(cache);
  });

  describe('size-based tests', () => {
    const maxSize = 2000;
    const cache = new InMemoryLRUCache<string>({ maxSize });
    it('does not allow the cache to grow out of bounds', async () => {
      expect.assertions(1);
      await cache.set('any value', 'a'.repeat(1000));
      await cache.set('any other value', 'a'.repeat(1000));
      await cache.set('yet another value', 'a'.repeat(1000));
      await expect(cache.getTotalSize()).resolves.toBe(maxSize);
    });
  });
});
