'use client';

import { toast } from 'sonner';

// Appels d'API côté navigateur. Une erreur remonte toujours avec un message
// lisible et, quand il y en a une, l'action qui débloque.

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public action?: { label: string; href: string },
  ) {
    super(message);
  }
}

export async function apiFetch<T = any>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiError(data?.error ?? `Erreur ${res.status}`, res.status, data?.code, data?.action);
  return data as T;
}

const safeJson = (t: string) => {
  try {
    return JSON.parse(t);
  } catch {
    return { error: t.slice(0, 200) };
  }
};

export const get = <T = any>(url: string) => apiFetch<T>(url);
export const post = <T = any>(url: string, json?: unknown) => apiFetch<T>(url, { method: 'POST', json: json ?? {} });
export const patch = <T = any>(url: string, json: unknown) => apiFetch<T>(url, { method: 'PATCH', json });
export const put = <T = any>(url: string, json: unknown) => apiFetch<T>(url, { method: 'PUT', json });
export const del = <T = any>(url: string) => apiFetch<T>(url, { method: 'DELETE' });

/** Affiche une erreur d'API, avec son bouton d'action éventuel. */
export function toastError(e: unknown, title?: string) {
  const err = e instanceof ApiError ? e : null;
  toast.error(title ?? (err?.message || (e instanceof Error ? e.message : 'Erreur')), {
    description: title ? err?.message : undefined,
    action: err?.action ? { label: err.action.label, onClick: () => (window.location.href = err.action!.href) } : undefined,
    duration: err?.action ? 12000 : 6000,
  });
}
