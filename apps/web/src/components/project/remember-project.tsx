'use client';

import { useEffect } from 'react';

export const LAST_PROJECT_KEY = 'regie:last-project';

/** Retient le dernier projet ouvert, pour pouvoir y revenir depuis les réglages. */
export function RememberProject({ id, title }: { id: string; title: string }) {
  useEffect(() => {
    try {
      localStorage.setItem(LAST_PROJECT_KEY, JSON.stringify({ id, title }));
    } catch {}
  }, [id, title]);
  return null;
}
