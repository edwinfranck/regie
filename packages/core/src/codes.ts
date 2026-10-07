// Les identifiants courts et stables : CH1, L3, P2, S1… Repris tels quels dans
// les prompts, ils ne changent jamais une fois attribués.
export const CODE_PREFIX = { character: 'CH', location: 'L', prop: 'P', style: 'S', light: '' } as const;

export function nextCode(prefix: string, taken: string[]) {
  const nums = taken.map((c) => Number(c.replace(prefix, ''))).filter((n) => Number.isFinite(n));
  return `${prefix}${(nums.length ? Math.max(...nums) : 0) + 1}`;
}

/** 12A, 12B… 12Z, 12AA : le code d'un plan dans sa scène. */
export function shotCode(sceneNumber: number, index: number) {
  let n = index;
  let s = '';
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `${sceneNumber}${s}`;
}

export const slugify = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'projet';
