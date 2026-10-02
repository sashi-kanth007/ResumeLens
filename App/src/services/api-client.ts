import { API_URL } from '@/config/env';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const DEFAULT_TIMEOUT_MS = 15_000;

export type RequestOptions = RequestInit & {
  /** Abort the request after this many milliseconds. */
  timeoutMs?: number;
};

/** Thin `fetch` wrapper that surfaces FastAPI's `detail` messages as errors. */
export async function request<T>(
  path: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS, ...init }: RequestOptions = {},
): Promise<T> {
  // Without a timeout, an unreachable host can leave the request pending for minutes.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Accept: 'application/json', ...init.headers },
    });
  } catch (e) {
    if (controller.signal.aborted) {
      throw new ApiError(
        `The server at ${API_URL} did not respond within ${Math.round(timeoutMs / 1000)}s.`,
        0,
      );
    }
    // Keep the underlying cause visible: not every fetch failure is a network problem.
    const cause = e instanceof Error ? ` (${e.message})` : '';
    throw new ApiError(
      `Could not reach the server at ${API_URL}.${cause} ` +
        'Check that the backend runs with --host 0.0.0.0, the phone is on the same Wi-Fi, ' +
        'and the firewall allows port 8000.',
      0,
    );
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new ApiError(await readErrorDetail(response), response.status);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function readErrorDetail(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === 'string') return body.detail;
    // FastAPI validation errors: { detail: [{ msg: '...' }] }
    if (Array.isArray(body?.detail) && body.detail[0]?.msg) return body.detail[0].msg;
  } catch {
    // Non-JSON error body; fall through.
  }
  return `Request failed with status ${response.status}.`;
}
