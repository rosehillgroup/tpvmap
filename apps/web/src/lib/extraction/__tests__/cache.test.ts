import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  MemoryCache, 
  getExtractionCache, 
  generateCacheKey, 
  ProgressiveLoader,
  type CacheEntry
} from '../cache';

describe('MemoryCache', () => {
  let cache: MemoryCache<string>;

  beforeEach(() => {
    cache = new MemoryCache<string>({
      defaultTTL: 1000,
      maxEntries: 3,
      cleanupInterval: 100
    });
  });

  afterEach(() => {
    cache.destroy();
  });

  describe('Basic operations', () => {
    it('should set and get values', () => {
      cache.set('key1', 'value1');
      
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return null for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeNull();
    });

    it('should check if key exists', () => {
      cache.set('key1', 'value1');
      
      expect(cache.has('key1')).toBe(true);
      expect(cache.has('nonexistent')).toBe(false);
    });

    it('should delete values', () => {
      cache.set('key1', 'value1');
      
      expect(cache.delete('key1')).toBe(true);
      expect(cache.get('key1')).toBeNull();
      expect(cache.delete('nonexistent')).toBe(false);
    });

    it('should clear all values', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBeNull();
    });

    it('should report correct size', () => {
      expect(cache.size()).toBe(0);
      
      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);
      
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
      
      cache.delete('key1');
      expect(cache.size()).toBe(1);
    });
  });

  describe('TTL (Time To Live)', () => {
    it('should expire entries after TTL', async () => {
      const shortCache = new MemoryCache<string>({ defaultTTL: 50 });
      
      shortCache.set('key1', 'value1');
      expect(shortCache.get('key1')).toBe('value1');
      
      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 60));
      
      expect(shortCache.get('key1')).toBeNull();
      expect(shortCache.has('key1')).toBe(false);
      
      shortCache.destroy();
    });

    it('should use custom TTL when provided', async () => {
      cache.set('key1', 'value1', 50); // Custom short TTL
      
      expect(cache.get('key1')).toBe('value1');
      
      await new Promise(resolve => setTimeout(resolve, 60));
      
      expect(cache.get('key1')).toBeNull();
    });

    it('should not expire entries before TTL', async () => {
      cache.set('key1', 'value1', 200);
      
      expect(cache.get('key1')).toBe('value1');
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      expect(cache.get('key1')).toBe('value1');
    });
  });

  describe('Max entries eviction', () => {
    it('should evict oldest entries when max exceeded', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');
      
      expect(cache.size()).toBe(3);
      
      // Adding 4th entry should evict oldest (key1)
      cache.set('key4', 'value4');
      
      expect(cache.size()).toBe(3);
      expect(cache.get('key1')).toBeNull();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });
  });

  describe('Hit counting', () => {
    it('should track hit counts', () => {
      cache.set('key1', 'value1');
      
      // Access the key multiple times
      cache.get('key1');
      cache.get('key1');
      cache.get('key1');
      
      const stats = cache.getStats();
      expect(stats.totalHits).toBeGreaterThan(0);
    });

    it('should not increment hits for non-existent keys', () => {
      const initialStats = cache.getStats();
      
      cache.get('nonexistent');
      
      const finalStats = cache.getStats();
      expect(finalStats.totalHits).toBe(initialStats.totalHits);
    });
  });

  describe('Stats', () => {
    it('should return accurate statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.get('key1');
      
      const stats = cache.getStats();
      
      expect(stats.entries).toBe(2);
      expect(stats.totalHits).toBeGreaterThan(0);
      expect(stats.averageAge).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThan(0);
    });

    it('should handle empty cache stats', () => {
      const stats = cache.getStats();
      
      expect(stats.entries).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.averageAge).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('Cleanup', () => {
    it('should clean up expired entries automatically', async () => {
      const cleanupCache = new MemoryCache<string>({
        defaultTTL: 50,
        cleanupInterval: 60
      });
      
      cleanupCache.set('key1', 'value1');
      cleanupCache.set('key2', 'value2');
      
      expect(cleanupCache.size()).toBe(2);
      
      // Wait for entries to expire and cleanup to run
      await new Promise(resolve => setTimeout(resolve, 120));
      
      expect(cleanupCache.size()).toBe(0);
      
      cleanupCache.destroy();
    });
  });
});

describe('generateCacheKey', () => {
  it('should generate consistent keys for same inputs', () => {
    const key1 = generateCacheKey('test.pdf', 1024, { maxColors: 10 });
    const key2 = generateCacheKey('test.pdf', 1024, { maxColors: 10 });
    
    expect(key1).toBe(key2);
  });

  it('should generate different keys for different inputs', () => {
    const key1 = generateCacheKey('test1.pdf', 1024, { maxColors: 10 });
    const key2 = generateCacheKey('test2.pdf', 1024, { maxColors: 10 });
    
    expect(key1).not.toBe(key2);
  });

  it('should include options in key generation', () => {
    const key1 = generateCacheKey('test.pdf', 1024, { maxColors: 10 });
    const key2 = generateCacheKey('test.pdf', 1024, { maxColors: 20 });
    
    expect(key1).not.toBe(key2);
  });

  it('should handle empty options', () => {
    const key1 = generateCacheKey('test.pdf', 1024);
    const key2 = generateCacheKey('test.pdf', 1024, {});
    
    expect(key1).toBe(key2);
  });

  it('should return base36 string', () => {
    const key = generateCacheKey('test.pdf', 1024, { maxColors: 10 });
    
    expect(typeof key).toBe('string');
    expect(key).toMatch(/^[0-9a-z]+$/);
  });
});

describe('getExtractionCache', () => {
  it('should return a cache instance', () => {
    const cache = getExtractionCache();
    
    expect(cache).toBeInstanceOf(MemoryCache);
  });

  it('should return the same instance on multiple calls', () => {
    const cache1 = getExtractionCache();
    const cache2 = getExtractionCache();
    
    expect(cache1).toBe(cache2);
  });

  it('should have extraction-specific configuration', () => {
    const cache = getExtractionCache();
    
    // Test that it works as expected for extraction use case
    cache.set('test-extraction', { palette: [], metadata: {} });
    
    expect(cache.get('test-extraction')).toBeDefined();
  });
});

describe('ProgressiveLoader', () => {
  let loader: ProgressiveLoader;

  beforeEach(() => {
    loader = new ProgressiveLoader();
  });

  describe('Progress tracking', () => {
    it('should track progress updates', () => {
      const mockCallback = vi.fn();
      
      loader.onProgress(mockCallback);
      loader.updateProgress('extracting', 50, 'Extracting colors...');
      
      expect(mockCallback).toHaveBeenCalledWith({
        stage: 'extracting',
        progress: 50,
        message: 'Extracting colors...',
        timeElapsed: expect.any(Number),
        estimatedTimeRemaining: undefined
      });
    });

    it('should handle multiple listeners', () => {
      const mockCallback1 = vi.fn();
      const mockCallback2 = vi.fn();
      
      loader.onProgress(mockCallback1);
      loader.onProgress(mockCallback2);
      loader.updateProgress('processing', 25, 'Processing...');
      
      expect(mockCallback1).toHaveBeenCalled();
      expect(mockCallback2).toHaveBeenCalled();
    });

    it('should allow unsubscribing from progress updates', () => {
      const mockCallback = vi.fn();
      
      const unsubscribe = loader.onProgress(mockCallback);
      loader.updateProgress('uploading', 10, 'Uploading...');
      
      expect(mockCallback).toHaveBeenCalledTimes(1);
      
      unsubscribe();
      loader.updateProgress('processing', 20, 'Processing...');
      
      expect(mockCallback).toHaveBeenCalledTimes(1); // Should not be called again
    });
  });

  describe('Progress validation', () => {
    it('should clamp progress values to 0-100 range', () => {
      const mockCallback = vi.fn();
      
      loader.onProgress(mockCallback);
      
      // Test negative value
      loader.updateProgress('uploading', -10, 'Test');
      expect(mockCallback).toHaveBeenLastCalledWith(
        expect.objectContaining({ progress: 0 })
      );
      
      // Test value over 100
      loader.updateProgress('complete', 150, 'Test');
      expect(mockCallback).toHaveBeenLastCalledWith(
        expect.objectContaining({ progress: 100 })
      );
    });
  });

  describe('Time tracking', () => {
    it('should track elapsed time', async () => {
      const mockCallback = vi.fn();
      
      loader.onProgress(mockCallback);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      loader.updateProgress('processing', 50, 'Processing...');
      
      const call = mockCallback.mock.calls[0][0];
      expect(call.timeElapsed).toBeGreaterThan(40);
    });

    it('should include estimated time remaining when provided', () => {
      const mockCallback = vi.fn();
      
      loader.onProgress(mockCallback);
      loader.updateProgress('extracting', 33, 'Extracting...', 2000);
      
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          estimatedTimeRemaining: 2000
        })
      );
    });
  });

  describe('Completion and error handling', () => {
    it('should handle completion', () => {
      const mockCallback = vi.fn();
      
      loader.onProgress(mockCallback);
      loader.complete();
      
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'complete',
          progress: 100,
          message: 'Extraction complete'
        })
      );
    });

    it('should handle errors', () => {
      const mockCallback = vi.fn();
      
      loader.onProgress(mockCallback);
      loader.error('Something went wrong');
      
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'error',
          progress: 0,
          message: 'Something went wrong'
        })
      );
    });
  });

  describe('Error handling in listeners', () => {
    it('should handle listener errors gracefully', () => {
      const mockCallback1 = vi.fn(() => {
        throw new Error('Callback error');
      });
      const mockCallback2 = vi.fn();
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      loader.onProgress(mockCallback1);
      loader.onProgress(mockCallback2);
      
      loader.updateProgress('processing', 50, 'Processing...');
      
      expect(mockCallback1).toHaveBeenCalled();
      expect(mockCallback2).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Progress listener error:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });
});