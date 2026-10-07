/** Le nom du produit, en minuscules comme dans l'application, avec le point signal. */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-semibold tracking-tight ${className}`}>
      <span aria-hidden className="size-2.5 rounded-[2px] bg-[var(--signal)]" />
      régie
    </span>
  );
}
