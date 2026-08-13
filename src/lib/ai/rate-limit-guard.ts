interface Bucket {
  lastReset: number;
  used: number;
  isBackingOff: boolean;
  backoffUntil: number;
}

const buckets = new Map<string, Bucket>();

const DEFAULT_LIMIT = 30;

function getBucket(key: string): Bucket {
  let b = buckets.get(key);
  if (!b) {
    b = { lastReset: Date.now(), used: 0, isBackingOff: false, backoffUntil: 0 };
    buckets.set(key, b);
  }
  return b;
}

export function resetLimit(key = "global", newLimit?: number) {
  const b = getBucket(key);
  b.lastReset = Date.now();
  b.used = 0;
  b.isBackingOff = false;
  void newLimit;
}

export function checkRateLimit(key = "global", limit = DEFAULT_LIMIT): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const b = getBucket(key);

  if (b.isBackingOff) {
    if (now < b.backoffUntil) {
      return { allowed: false, retryAfter: Math.ceil((b.backoffUntil - now) / 1000) };
    }
    b.isBackingOff = false;
  }

  if (now - b.lastReset > 60_000) {
    b.lastReset = now;
    b.used = 0;
  }

  if (b.used >= limit) {
    const retryAfter = Math.ceil((b.lastReset + 60_000 - now) / 1000);
    return { allowed: false, retryAfter };
  }

  b.used++;
  return { allowed: true };
}

export function handleRateLimitError(key = "global"): void {
  const now = Date.now();
  const b = getBucket(key);
  b.isBackingOff = true;
  b.backoffUntil = now + 30_000;
}

export function getUsage(key = "global"): { used: number; limit: number } {
  const b = getBucket(key);
  return { used: b.used, limit: DEFAULT_LIMIT };
}