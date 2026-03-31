export class StormHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'StormHttpError';
  }
}

const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];
const REQUEST_TIMEOUT_MS = 30_000;

export class StormHttpClient {
  constructor(
    private readonly baseUrl: string,
    private readonly agentToken: string,
  ) {}

  async get<T>(path: string): Promise<T> {
    return this._request<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this._request<T>('POST', path, body);
  }

  private async _request<T>(method: string, path: string, body?: unknown): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await sleep(RETRY_DELAYS[attempt - 1] ?? 4000);
      }

      let res: Response;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        res = await fetch(`${this.baseUrl}${path}`, {
          method,
          signal: controller.signal,
          headers: {
            Authorization: `agent ${this.agentToken}`,
            Accept: 'application/json',
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        clearTimeout(timer);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES) continue;
        throw lastError;
      }

      const text = await res.text();

      if (!res.ok) {
        const parsed = text ? safeJsonParse(text) : undefined;
        const httpErr = new StormHttpError(
          `HTTP ${res.status} for ${method} ${path}`,
          res.status,
          parsed ?? text,
        );
        if (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_RETRIES) {
          lastError = httpErr;
          continue;
        }
        throw httpErr;
      }

      if (!text) {
        throw new StormHttpError(
          `Empty response body for ${method} ${path}`,
          res.status,
        );
      }

      try {
        return JSON.parse(text) as T;
      } catch {
        throw new StormHttpError(
          `Invalid JSON response for ${method} ${path}`,
          res.status,
          text,
        );
      }
    }

    throw lastError ?? new Error('Request failed after retries');
  }
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
