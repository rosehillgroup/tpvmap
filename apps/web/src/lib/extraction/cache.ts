export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

export interface CacheOptions {
  defaultTTL?: number; // milliseconds
  maxEntries?: number;
  cleanupInterval?: number;
}

export class MemoryCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private options: Required<CacheOptions>;
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: CacheOptions = {}) {
    this.options = {
      defaultTTL: options.defaultTTL ?? 30 * 60 * 1000, // 30 minutes
      maxEntries: options.maxEntries ?? 100,
      cleanupInterval: options.cleanupInterval ?? 5 * 60 * 1000 // 5 minutes
    };

    this.startCleanup();
  }

  set(key: string, data: T, ttl?: number): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl ?? this.options.defaultTTL,
      hits: 0
    };

    this.cache.set(key, entry);
    this.evictOldest();
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    const age = now - entry.timestamp;
    
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    entry.hits++;
    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    const now = Date.now();
    const age = now - entry.timestamp;
    
    if (age > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getStats(): {
    entries: number;
    totalHits: number;
    averageAge: number;
    hitRate: number;
  } {
    const entries = Array.from(this.cache.values());
    const now = Date.now();
    
    const totalHits = entries.reduce((sum, entry) => sum + entry.hits, 0);
    const totalAge = entries.reduce((sum, entry) => sum + (now - entry.timestamp), 0);
    const averageAge = entries.length > 0 ? totalAge / entries.length : 0;
    
    // Simple hit rate approximation
    const hitRate = entries.length > 0 ? totalHits / entries.length : 0;

    return {
      entries: entries.length,
      totalHits,
      averageAge,
      hitRate
    };
  }

  private evictOldest(): void {
    if (this.cache.size <= this.options.maxEntries) {
      return;
    }

    // Find oldest entry by timestamp
    let oldestKey = '';
    let oldestTime = Date.now();
    
    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.options.cleanupInterval);
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

// Global extraction cache instance
let extractionCache: MemoryCache<any> | null = null;

export function getExtractionCache(): MemoryCache<any> {
  if (!extractionCache) {
    extractionCache = new MemoryCache({
      defaultTTL: 60 * 60 * 1000, // 1 hour for extraction results
      maxEntries: 50,
      cleanupInterval: 10 * 60 * 1000 // 10 minutes
    });
  }
  return extractionCache;
}

// Hash function for cache keys
export function generateCacheKey(filename: string, fileSize: number, options: any = {}): string {
  const optionsStr = JSON.stringify(options);
  const combined = `${filename}-${fileSize}-${optionsStr}`;
  
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  return Math.abs(hash).toString(36);
}

// Utility for progressive loading states
export interface ProgressiveLoadingState {
  stage: 'uploading' | 'processing' | 'extracting' | 'caching' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  timeElapsed: number;
  estimatedTimeRemaining?: number;
}

export class ProgressiveLoader {
  private startTime: number = Date.now();
  private currentStage: ProgressiveLoadingState['stage'] = 'uploading';
  private listeners: ((state: ProgressiveLoadingState) => void)[] = [];
  
  constructor() {
    this.startTime = Date.now();
  }

  onProgress(callback: (state: ProgressiveLoadingState) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  updateProgress(
    stage: ProgressiveLoadingState['stage'],
    progress: number,
    message: string,
    estimatedTimeRemaining?: number
  ): void {
    this.currentStage = stage;
    const timeElapsed = Date.now() - this.startTime;
    
    const state: ProgressiveLoadingState = {
      stage,
      progress: Math.max(0, Math.min(100, progress)),
      message,
      timeElapsed,
      estimatedTimeRemaining
    };

    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch (error) {
        console.error('Progress listener error:', error);
      }
    }
  }

  complete(): void {
    this.updateProgress('complete', 100, 'Extraction complete');
  }

  error(message: string): void {
    this.updateProgress('error', 0, message);
  }
}