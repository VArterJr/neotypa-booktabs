import { BASE_PATH } from '../config.js';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('/') ? `${BASE_PATH}${path}` : path;
  const res = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {})
    }
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? `Request failed: ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
