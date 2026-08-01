/**
 * The Sidelick brand loader — the mark trotting in place (toes tap in
 * sequence, heart bobs). Reserved for BRAND MOMENTS only: the auth gate,
 * route transitions, payment confirmation. Lists and cards keep skeletons —
 * they feel faster. Reduced-motion users see the static mark.
 */
export function LogoLoader({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <span role="status" className="inline-flex flex-col items-center gap-3">
      <svg viewBox="0 0 100 100" className={`${className} text-primary`} fill="currentColor" aria-hidden="true">
        <ellipse className="slk-toe" cx="20" cy="35" rx="10" ry="11.5" transform="rotate(-24 20 35)" />
        <ellipse className="slk-toe" style={{ animationDelay: "0.12s" }} cx="39.5" cy="20.5" rx="9.8" ry="11.5" transform="rotate(-9 39.5 20.5)" />
        <ellipse className="slk-toe" style={{ animationDelay: "0.24s" }} cx="62.5" cy="20.5" rx="9.8" ry="11.5" transform="rotate(9 62.5 20.5)" />
        <ellipse className="slk-toe" style={{ animationDelay: "0.36s" }} cx="85" cy="29" rx="10" ry="11.5" transform="rotate(42 85 29)" />
        <path className="slk-heart-bob" d="M51 92 C 43.5 85.5, 26 74.5, 26 59.5 C 26 49, 34 43.5, 41.8 43.5 C 46.4 43.5, 49.5 46, 51 49 C 52.5 46, 55.6 43.5, 60.2 43.5 C 68 43.5, 76 49, 76 59.5 C 76 74.5, 58.5 85.5, 51 92 Z" />
      </svg>
      <span className="sr-only">Loading…</span>
    </span>
  );
}
