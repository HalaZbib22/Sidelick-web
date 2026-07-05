"use client";

import { motion, useReducedMotion } from "framer-motion";

interface AnimatedHeadlineProps {
  text: string;
  className?: string;
}

/** Headline whose words fade + rise in a gentle stagger on mount. Reduce-motion safe. */
export function AnimatedHeadline({ text, className }: AnimatedHeadlineProps) {
  const reduce = useReducedMotion();
  if (reduce) return <h1 className={className}>{text}</h1>;

  const words = text.split(" ");
  return (
    <h1 className={className} aria-label={text}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          aria-hidden
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: i * 0.06, ease: "easeOut" }}
          style={{ display: "inline-block", marginRight: "0.25em" }}
        >
          {w}
        </motion.span>
      ))}
    </h1>
  );
}
