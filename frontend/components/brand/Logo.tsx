/**
 * The Sidelick brand mark — a paw whose main pad is a heart ("your sidekick
 * with a lick"), with the outer toe kicked mid-step: a walk in progress.
 * Single-color so it inherits `currentColor`; pair with the Fraunces wordmark
 * via <Logo />.
 */
export function LogoMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden="true">
      <ellipse cx="20" cy="35" rx="10" ry="11.5" transform="rotate(-24 20 35)" />
      <ellipse cx="39.5" cy="20.5" rx="9.8" ry="11.5" transform="rotate(-9 39.5 20.5)" />
      <ellipse cx="62.5" cy="20.5" rx="9.8" ry="11.5" transform="rotate(9 62.5 20.5)" />
      <ellipse cx="85" cy="29" rx="10" ry="11.5" transform="rotate(42 85 29)" />
      <path d="M51 92 C 43.5 85.5, 26 74.5, 26 59.5 C 26 49, 34 43.5, 41.8 43.5 C 46.4 43.5, 49.5 46, 51 49 C 52.5 46, 55.6 43.5, 60.2 43.5 C 68 43.5, 76 49, 76 59.5 C 76 74.5, 58.5 85.5, 51 92 Z" />
    </svg>
  );
}

/** Mark + Fraunces wordmark lockup, in brand coral. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-primary ${className}`}>
      <LogoMark className="h-[1.15em] w-[1.15em]" />
      <span className="font-display font-semibold leading-none">Sidelick</span>
    </span>
  );
}
