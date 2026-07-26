/**
 * The Sidelick verification seal — a crisp teal circle with a knocked-out
 * check (the WhatsApp/Telegram pattern; simple geometry stays sharp at any
 * size). Icon-only by design: one glance, no label clutter. Tooltip + aria
 * carry the meaning for hover and screen readers.
 */
export function VerifiedBadge({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <span
      title="ID verified"
      role="img"
      aria-label="ID verified"
      className="inline-flex shrink-0 text-trust"
    >
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path
          d="M7.8 12.4l2.7 2.7 5.7-5.7"
          fill="none"
          stroke="hsl(var(--surface))"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
