'use client';

import { useCallback, useEffect, useRef } from 'react';
import { toastError } from '@/lib/client';
import { useSaveStatus } from './use-project';

/**
 * Enregistrement automatique : les modifications s'accumulent et partent
 * ensemble après `delay` ms de calme. `flush` force l'envoi (sortie de page).
 */
export function useAutosave<T extends Record<string, unknown>>(save: (patch: Partial<T>) => Promise<unknown>, delay = 800) {
  const pending = useRef<Partial<T>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setStatus = useSaveStatus((s) => s.set);
  const saveRef = useRef(save);
  saveRef.current = save;

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    if (!Object.keys(patch).length) return;
    pending.current = {};
    setStatus('saving');
    try {
      await saveRef.current(patch);
      setStatus('saved');
    } catch (e) {
      setStatus('error');
      toastError(e, 'Enregistrement impossible');
    }
  }, [setStatus]);

  const queue = useCallback(
    (patch: Partial<T>) => {
      pending.current = { ...pending.current, ...patch };
      setStatus('saving');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [delay, flush, setStatus],
  );

  useEffect(() => {
    const onLeave = () => void flush();
    window.addEventListener('beforeunload', onLeave);
    return () => {
      window.removeEventListener('beforeunload', onLeave);
      void flush();
    };
  }, [flush]);

  return { queue, flush };
}
