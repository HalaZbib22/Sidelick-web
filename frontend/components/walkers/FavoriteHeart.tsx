"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Heart } from "lucide-react";

/**
 * The favorite heart — Sidelick's signature micro-interaction.
 * Tap to save: the heart springs (squash → overshoot → settle), fills coral,
 * and fires a soft burst — an expanding ring plus six radiating sparks.
 * Unfavoriting is deliberately quiet (fill drains, no celebration).
 * Honors reduced motion (instant fill swap, no burst).
 */
export function FavoriteHeart({
  active,
  onToggle,
  disabled = false,
  size = "md",
  className = "",
}: {
  active: boolean;
  onToggle: () => void;
  disabled?: boolean;
  /** sm = list cards, md = profile header / prompts */
  size?: "sm" | "md";
  className?: string;
}) {
  const reduce = useReducedMotion();
  // Keyed re-mount of the burst on each save (not on unsave).
  const [burst, setBurst] = useState(0);

  const btn = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const icon = size === "sm" ? "h-[18px] w-[18px]" : "h-[22px] w-[22px]";
  const sparkRadius = size === "sm" ? 16 : 20;

  function handleTap() {
    if (disabled) return;
    if (!active && !reduce) setBurst((b) => b + 1);
    onToggle();
  }

  return (
    <motion.button
      type="button"
      onClick={handleTap}
      disabled={disabled}
      whileTap={reduce ? undefined : { scale: 0.82 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      aria-label={active ? "Remove from saved walkers" : "Save walker"}
      aria-pressed={active}
      className={`relative flex ${btn} shrink-0 items-center justify-center rounded-full border border-border bg-surface/80 shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md disabled:opacity-50 ${className}`}
    >
      {/* The heart itself — springs on save */}
      <motion.span
        key={active ? `on-${burst}` : "off"}
        initial={reduce || !active ? false : { scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 480, damping: 14 }}
        className="flex items-center justify-center"
      >
        <Heart
          className={`${icon} transition-colors duration-200 ${
            active ? "fill-primary text-primary" : "fill-transparent text-muted-foreground"
          }`}
        />
      </motion.span>

      {/* Save celebration: expanding ring + six coral sparks */}
      <AnimatePresence>
        {burst > 0 && active && !reduce && (
          <motion.span
            key={burst}
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-primary"
              initial={{ scale: 0.5, opacity: 0.7 }}
              animate={{ scale: 1.7, opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
            {Array.from({ length: 6 }).map((_, i) => {
              const angle = (i / 6) * Math.PI * 2 - Math.PI / 2;
              return (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full bg-primary"
                  initial={{ x: "-50%", y: "-50%", scale: 1, opacity: 0.9 }}
                  animate={{
                    x: `calc(-50% + ${Math.cos(angle) * sparkRadius}px)`,
                    y: `calc(-50% + ${Math.sin(angle) * sparkRadius}px)`,
                    scale: 0,
                    opacity: 0,
                  }}
                  transition={{ duration: 0.55, ease: "easeOut", delay: 0.04 }}
                />
              );
            })}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
