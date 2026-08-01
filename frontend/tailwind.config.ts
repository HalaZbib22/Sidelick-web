import type { Config } from "tailwindcss";

const hsl = (v: string) => `hsl(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./contexts/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: hsl("--border"),
        background: hsl("--background"),
        surface: hsl("--surface"),
        foreground: hsl("--foreground"),
        primary: {
          DEFAULT: hsl("--primary"),
          foreground: hsl("--primary-foreground"),
        },
        accent: {
          DEFAULT: hsl("--accent"),
          foreground: hsl("--accent-foreground"),
          subtle: hsl("--accent-subtle"),
        },
        muted: {
          DEFAULT: hsl("--muted"),
          foreground: hsl("--muted-foreground"),
        },
        trust: {
          DEFAULT: hsl("--trust"),
          foreground: hsl("--trust-foreground"),
          subtle: hsl("--trust-subtle"),
          strong: hsl("--trust-strong"),
        },
        link: hsl("--link"),
        danger: hsl("--danger"),
        warning: hsl("--warning"),
        // shadcn aliases
        card: { DEFAULT: hsl("--card"), foreground: hsl("--card-foreground") },
        popover: { DEFAULT: hsl("--popover"), foreground: hsl("--popover-foreground") },
        secondary: { DEFAULT: hsl("--secondary"), foreground: hsl("--secondary-foreground") },
        destructive: { DEFAULT: hsl("--destructive"), foreground: hsl("--destructive-foreground") },
        input: hsl("--input"),
        ring: hsl("--ring"),
      },
      ringColor: {
        DEFAULT: hsl("--ring"),
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
      },
      boxShadow: {
        // Warm, brand-tinted elevation scale (shadows lean into the ink brown
        // rather than pure black, so they sit naturally on the cream palette).
        xs: "0 1px 2px hsl(21 37% 12% / 0.05)",
        sm: "0 1px 3px hsl(21 37% 12% / 0.06), 0 1px 2px hsl(21 37% 12% / 0.04)",
        DEFAULT: "0 4px 12px hsl(21 37% 12% / 0.06), 0 2px 4px hsl(21 37% 12% / 0.04)",
        md: "0 8px 20px hsl(21 37% 12% / 0.08), 0 3px 6px hsl(21 37% 12% / 0.05)",
        lg: "0 16px 32px hsl(21 37% 12% / 0.10), 0 6px 12px hsl(21 37% 12% / 0.05)",
        xl: "0 28px 56px hsl(21 37% 12% / 0.14), 0 10px 20px hsl(21 37% 12% / 0.06)",
        // Coral-tinted glow for the primary CTA / hero focal point.
        glow: "0 12px 32px hsl(16 76% 43% / 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
