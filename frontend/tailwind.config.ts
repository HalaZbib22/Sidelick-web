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
    },
  },
  plugins: [],
};

export default config;
