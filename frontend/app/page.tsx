import Link from "next/link";
import { routes, buildSignupPath } from "../lib/paths";
import { Reveal } from "../components/motion/Reveal";
import { TiltCard } from "../components/motion/TiltCard";
import { MagneticLink } from "../components/motion/MagneticLink";
import { AnimatedHeadline } from "../components/landing/AnimatedHeadline";
import { TestimonialsCarousel } from "../components/landing/TestimonialsCarousel";
import { ThemeToggle } from "../components/ui/ThemeToggle";

const STEPS = [
  { n: "1", t: "Find a verified walker", d: "Browse trusted, ID-checked walkers and sitters near you, with real ratings." },
  { n: "2", t: "Book in seconds", d: "Pick walk, daycare, or travel sitting. See a clear price before you confirm." },
  { n: "3", t: "Follow along", d: "Get photos and check-ins during every visit, and message your walker anytime." },
];

const TESTIMONIALS = [
  { initials: "LA", name: "Lara A.", city: "Beirut", quote: "Booked a sitter for a week away and got daily photos. Came home to a happy, well-walked dog." },
  { initials: "KM", name: "Karim M.", city: "Beirut", quote: "The same walker every morning, and I can see exactly when they arrive. Total peace of mind." },
  { initials: "RH", name: "Rana H.", city: "Beirut", quote: "Walk Share saved me 20% and my dog made a new friend on every group walk. Win-win." },
  { initials: "TD", name: "Tarek D.", city: "Beirut", quote: "Verification gave me real confidence. I knew exactly who was coming to care for my dog." },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="font-display text-xl font-semibold text-primary">Sidelick</span>
        <nav className="flex items-center gap-3 text-sm">
          <ThemeToggle />
          <Link href={routes.signin} className="text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Link
            href={buildSignupPath("user")}
            className="lift rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground hover:opacity-90"
          >
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-8 pt-6 md:grid-cols-2 md:pt-12">
        <div>
          <span className="slk-rise inline-block rounded-full bg-trust-subtle px-3 py-1 text-xs font-medium text-trust-strong">
            ★ 4.9 · trusted by 2,000+ dog owners
          </span>
          <AnimatedHeadline
            text="Loved by your dog. Trusted by you."
            className="font-display mt-4 text-[2.6rem] font-medium leading-[1.05] text-foreground sm:text-[3.25rem]"
          />
          <p
            className="slk-rise mt-4 max-w-md text-base leading-relaxed text-muted-foreground"
            style={{ animationDelay: "0.16s" }}
          >
            Walks, daycare, and travel sitting — all from one verified walker near you. Vetted,
            insured, and tracked every step of the way.
          </p>
          <div className="slk-rise mt-7 flex flex-wrap gap-3" style={{ animationDelay: "0.24s" }}>
            <MagneticLink
              href={buildSignupPath("user")}
              className="lift rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Find a walker
            </MagneticLink>
            <Link
              href={buildSignupPath("walker")}
              className="lift rounded-full border border-border bg-surface px-6 py-3 text-sm font-medium hover:bg-muted"
            >
              Become a walker
            </Link>
          </div>
        </div>

        <div className="relative mx-auto flex w-full max-w-sm justify-center py-6 md:justify-end">
          {/* Soft ambient wash so the device reads as floating, not pasted on. */}
          <div className="pointer-events-none absolute -inset-4 -z-10 rounded-[3rem] bg-accent-subtle/70 blur-2xl" />

          {/* Phone frame — a live-walk tracking screen, i.e. the actual product. */}
          <div className="relative w-[250px] rounded-[2.6rem] bg-foreground p-2.5 shadow-xl">
            <div className="overflow-hidden rounded-[2.1rem] bg-background">
              {/* App header */}
              <div className="flex items-center justify-between px-4 pb-3 pt-4">
                <span className="text-sm font-display font-semibold text-primary">Sidelick</span>
                <span className="flex items-center gap-1.5 rounded-full bg-trust-subtle px-2 py-0.5 text-[10px] font-medium text-trust-strong">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-trust opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-trust" />
                  </span>
                  Live walk
                </span>
              </div>

              {/* Route / map strip */}
              <div className="relative mx-3 h-24 overflow-hidden rounded-2xl bg-gradient-to-br from-trust-subtle via-accent-subtle to-muted">
                <svg viewBox="0 0 200 96" className="absolute inset-0 h-full w-full" aria-hidden="true">
                  <path d="M18 78 C 60 68, 70 26, 120 30 S 178 40, 186 20" fill="none" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 6" />
                  <circle cx="18" cy="78" r="4" fill="hsl(var(--trust))" />
                  <circle cx="186" cy="20" r="4" fill="hsl(var(--primary))" />
                </svg>
              </div>

              {/* Walker row */}
              <div className="mx-3 mt-3 flex items-center gap-2.5 rounded-2xl border border-border bg-surface p-2.5 shadow-sm">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-trust-subtle text-xs font-semibold text-trust-strong">
                  SK
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-[13px] font-medium text-foreground">
                    Sara K.
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-trust" fill="currentColor" aria-hidden="true">
                      <path d="M12 2l2.4 1.8 3 .3 1 2.8 2 2.2-1 2.8.4 3-2.6 1.4-1.4 2.6-3-.4-2.8 1-2.2-2-2.8 1-1.4-2.6L4.2 15l.4-3-1-2.8 2-2.2 1-2.8 3-.3z" />
                      <path d="M10.6 14.3l-1.9-1.9-1.1 1.1 3 3 5-5-1.1-1.1z" fill="hsl(var(--surface))" />
                    </svg>
                  </span>
                  <span className="block text-[11px] text-muted-foreground">0.4 mi away · 18 min in</span>
                </span>
              </div>

              {/* Latest photo update */}
              <div className="mx-3 mb-4 mt-2 rounded-2xl border border-border bg-surface p-2.5 shadow-sm">
                <span className="text-[11px] font-medium text-muted-foreground">New photo from your walk</span>
                <div className="mt-1.5 h-16 rounded-xl bg-gradient-to-br from-accent-subtle to-trust-subtle" />
              </div>
            </div>
          </div>

          {/* Floating status chips around the device. */}
          <div className="slk-float absolute -left-2 top-10 flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 shadow-md">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-trust-subtle text-xs font-medium text-trust-strong">
              SK
            </span>
            <span>
              <span className="block text-xs font-medium">Sara · Verified</span>
              <span className="block text-[11px] text-muted-foreground">on a walk now</span>
            </span>
          </div>
          <div
            className="slk-float absolute bottom-10 -right-2 rounded-2xl border border-border bg-surface px-3 py-2 shadow-md"
            style={{ animationDelay: "1.5s" }}
          >
            <span className="block text-[11px] text-muted-foreground">Walk Share</span>
            <span className="block text-sm font-medium text-primary">save 20%</span>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-3 px-6 py-4 sm:grid-cols-3">
        {[
          ["Verified & insured", "ID-checked walkers"],
          ["Live updates", "photos & check-ins"],
          ["One trusted person", "walk, daycare & travel"],
        ].map(([t, d]) => (
          <div key={t} className="lift rounded-2xl border border-border bg-surface p-4 shadow-sm hover:shadow-md">
            <p className="text-sm font-medium">{t}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>

      <Reveal>
      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="font-display text-center text-3xl font-medium">How Sidelick works</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <TiltCard key={s.n} className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
                {s.n}
              </span>
              <p className="mt-4 font-medium">{s.t}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
            </TiltCard>
          ))}
        </div>
      </section>
      </Reveal>

      <Reveal>
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <h2 className="font-display mb-6 text-center text-3xl font-medium">Loved by dog owners</h2>
        <TestimonialsCarousel items={TESTIMONIALS} />
      </section>
      </Reveal>

      <Reveal>
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-[2rem] bg-primary px-8 py-12 text-center text-primary-foreground shadow-glow">
          <h2 className="font-display text-3xl font-medium">Ready to find your dog’s new best friend?</h2>
          <p className="mx-auto mt-2 max-w-md text-sm opacity-90">
            Join dog owners across Beirut booking trusted care in minutes.
          </p>
          <MagneticLink
            href={buildSignupPath("user")}
            className="lift mt-6 inline-block rounded-full bg-surface px-6 py-3 text-sm font-medium text-primary hover:opacity-90"
          >
            Get started free
          </MagneticLink>
        </div>
      </section>
      </Reveal>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <span className="font-medium text-primary">Sidelick</span>
          <nav className="flex gap-5">
            <Link href={routes.signin} className="hover:text-foreground">Sign in</Link>
            <Link href={buildSignupPath("walker")} className="hover:text-foreground">Become a walker</Link>
          </nav>
          <span>© {new Date().getFullYear()} Sidelick</span>
        </div>
      </footer>
    </main>
  );
}
