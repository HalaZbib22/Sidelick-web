"use client";

export interface Testimonial {
  initials: string;
  name: string;
  city: string;
  quote: string;
}

/**
 * Horizontal, scroll-snapping testimonials rail. Pure CSS snap — no JS, no deps,
 * and naturally reduce-motion safe (smooth scroll is the only motion, gated below).
 */
export function TestimonialsCarousel({ items }: { items: Testimonial[] }) {
  return (
    <div
      className="slk-snap-rail -mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 pb-2"
      role="list"
      aria-label="What dog owners say"
    >
      {items.map((r) => (
        <figure
          key={r.name}
          role="listitem"
          className="w-[85%] flex-none snap-start rounded-2xl border border-border bg-surface p-6 sm:w-[46%] lg:w-[31%]"
        >
          <blockquote className="text-sm leading-relaxed text-foreground">“{r.quote}”</blockquote>
          <figcaption className="mt-4 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent-subtle text-xs font-medium text-link">
              {r.initials}
            </span>
            <span className="text-sm">
              <span className="block font-medium">{r.name}</span>
              <span className="block text-muted-foreground">{r.city}</span>
            </span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
