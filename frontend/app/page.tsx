import Link from "next/link";
import { routes, buildSignupPath } from "../lib/paths";
import { Reveal } from "../components/motion/Reveal";
import { TiltCard } from "../components/motion/TiltCard";
import { MagneticLink } from "../components/motion/MagneticLink";
import { AnimatedHeadline } from "../components/landing/AnimatedHeadline";
import { TestimonialsCarousel } from "../components/landing/TestimonialsCarousel";
import { ThemeToggle } from "../components/ui/ThemeToggle";

function PawIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <circle cx="6" cy="9" r="2.1" />
      <circle cx="10.4" cy="6" r="2.1" />
      <circle cx="13.6" cy="6" r="2.1" />
      <circle cx="18" cy="9" r="2.1" />
      <path d="M12 11c-2.6 0-4.8 2.2-4.8 4.4 0 1.7 1.4 2.6 3 2.6 1 0 1.2-.4 1.8-.4s.8.4 1.8.4c1.6 0 3-.9 3-2.6C16.8 13.2 14.6 11 12 11z" />
    </svg>
  );
}

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
        <span className="text-lg font-medium text-primary">Sidelick</span>
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
            text="Care your dog will love, from people you can trust."
            className="mt-4 text-4xl font-medium leading-tight text-foreground sm:text-5xl"
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

        <div className="relative mx-auto h-64 w-full max-w-sm md:h-80">
          <div className="absolute inset-0 rounded-[2rem] bg-accent-subtle" />
          <div className="absolute inset-0 flex items-center justify-center">
            <PawIcon className="h-24 w-24 text-primary/80" />
          </div>
          <div className="slk-float absolute left-0 top-6 flex items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-trust-subtle text-xs font-medium text-trust-strong">
              SK
            </span>
            <span>
              <span className="block text-xs font-medium">Sara · Verified</span>
              <span className="block text-[11px] text-muted-foreground">on a walk now</span>
            </span>
          </div>
          <div
            className="slk-float absolute bottom-8 right-0 rounded-2xl border border-border bg-surface px-3 py-2"
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
          <div key={t} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-sm font-medium">{t}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>

      <Reveal>
      <section className="mx-auto max-w-6xl px-6 py-14">
        <h2 className="text-center text-2xl font-medium">How Sidelick works</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((s) => (
            <TiltCard key={s.n} className="rounded-2xl border border-border bg-surface p-6">
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
        <h2 className="mb-6 text-center text-2xl font-medium">Loved by dog owners</h2>
        <TestimonialsCarousel items={TESTIMONIALS} />
      </section>
      </Reveal>

      <Reveal>
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-[2rem] bg-primary px-8 py-12 text-center text-primary-foreground">
          <h2 className="text-2xl font-medium">Ready to find your dog’s new best friend?</h2>
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
