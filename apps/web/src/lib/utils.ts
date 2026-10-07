import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmtUsd = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : n < 0.01 && n > 0 ? '< 0,01 $' : `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

export const fmtBytes = (n: number) => (n < 1024 ? `${n} o` : n < 1024 ** 2 ? `${(n / 1024).toFixed(0)} Ko` : n < 1024 ** 3 ? `${(n / 1024 ** 2).toFixed(1)} Mo` : `${(n / 1024 ** 3).toFixed(2)} Go`);

export const fmtDate = (d: string | Date) => new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export const fmtRelative = (d: string | Date) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 7 * 86400) return `il y a ${Math.floor(s / 86400)} j`;
  return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
};

export const fmtDuration = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m ? `${m} min ${String(s).padStart(2, '0')}` : `${s} s`;
};
