"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";

const MotionLink = motion(Link);

interface MagneticLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  /** How far the element drifts toward the cursor, as a fraction of the offset. */
  strength?: number;
}

/**
 * A Next.js Link that drifts toward the cursor on hover for a tactile, magnetic feel.
 * Reduce-motion renders a plain Link, so it's safe and accessible by default.
 */
export function MagneticLink({ href, children, className, strength = 0.4 }: MagneticLinkProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useSpring(useMotionValue(0), { stiffness: 250, damping: 18, mass: 0.4 });
  const y = useSpring(useMotionValue(0), { stiffness: 250, damping: 18, mass: 0.4 });

  if (reduce) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <MotionLink
      ref={ref}
      href={href}
      style={{ x, y, display: "inline-block" }}
      className={className}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </MotionLink>
  );
}
