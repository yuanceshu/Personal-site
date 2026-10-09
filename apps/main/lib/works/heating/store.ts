/** The existing business engine's CAS contract, now scoped to one HTTP request. */
export interface HeatingStore {
  read(key: string): Promise<string | null>;
  compareAndSwap(key: string, expected: string | null, next: string, ttlSeconds: number): Promise<boolean>;
}

/** Never global, never reused between requests. State is supplied by the page's authenticated capsule. */
export class RequestHeatingStore implements HeatingStore {
  private data: Map<string, string>;
  constructor(entries: Record<string, string> = {}) { this.data = new Map(Object.entries(entries)); }
  async read(key: string) { return this.data.get(key) ?? null; }
  async compareAndSwap(key: string, expected: string | null, next: string, _ttlSeconds: number) {
    void _ttlSeconds; // No retention timer: this Store dies with the HTTP request.
    if ((this.data.get(key) ?? null) !== expected) return false;
    this.data.set(key, next); return true;
  }
  entries() { return Object.fromEntries(this.data); }
  replace(entries: Record<string, string>) { this.data = new Map(Object.entries(entries)); }
}
