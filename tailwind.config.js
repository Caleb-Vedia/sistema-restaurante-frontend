/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],

  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },

      colors: {
        border: "oklch(var(--border) / <alpha-value>)",
        input: "oklch(var(--input) / <alpha-value>)",
        ring: "oklch(var(--ring) / <alpha-value>)",

        background: "oklch(var(--background) / <alpha-value>)",
        foreground: "oklch(var(--foreground) / <alpha-value>)",

        primary: {
          DEFAULT: "oklch(var(--primary) / <alpha-value>)",
          foreground: "oklch(var(--primary-foreground) / <alpha-value>)",
        },

        secondary: {
          DEFAULT: "oklch(var(--secondary) / <alpha-value>)",
          foreground: "oklch(var(--secondary-foreground) / <alpha-value>)",
        },

        destructive: {
          DEFAULT: "oklch(var(--destructive) / <alpha-value>)",
        },

        success: {
          DEFAULT: "oklch(var(--success) / <alpha-value>)",
          foreground: "oklch(var(--success-foreground) / <alpha-value>)",
        },

        warning: {
          DEFAULT: "oklch(var(--warning) / <alpha-value>)",
          foreground: "oklch(var(--warning-foreground) / <alpha-value>)",
        },

        info: {
          DEFAULT: "oklch(var(--info) / <alpha-value>)",
          foreground: "oklch(var(--info-foreground) / <alpha-value>)",
        },

        muted: {
          DEFAULT: "oklch(var(--muted) / <alpha-value>)",
          foreground: "oklch(var(--muted-foreground) / <alpha-value>)",
        },

        accent: {
          DEFAULT: "oklch(var(--accent) / <alpha-value>)",
          foreground: "oklch(var(--accent-foreground) / <alpha-value>)",
        },

        popover: {
          DEFAULT: "oklch(var(--popover) / <alpha-value>)",
          foreground: "oklch(var(--popover-foreground) / <alpha-value>)",
        },

        card: {
          DEFAULT: "oklch(var(--card) / <alpha-value>)",
          foreground: "oklch(var(--card-foreground) / <alpha-value>)",
        },

        sidebar: {
          DEFAULT: "oklch(var(--sidebar) / <alpha-value>)",
          foreground: "oklch(var(--sidebar-foreground) / <alpha-value>)",
          primary: "oklch(var(--sidebar-primary) / <alpha-value>)",
          "primary-foreground": "oklch(var(--sidebar-primary-foreground) / <alpha-value>)",
          accent: "oklch(var(--sidebar-accent) / <alpha-value>)",
          "accent-foreground": "oklch(var(--sidebar-accent-foreground) / <alpha-value>)",
          border: "oklch(var(--sidebar-border) / <alpha-value>)",
          ring: "oklch(var(--sidebar-ring) / <alpha-value>)",
        },
      },

      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },

      boxShadow: {
        sm: "0 1px 2px 0 rgb(35 20 10 / 0.04)",
        DEFAULT: "0 1px 3px 0 rgb(35 20 10 / 0.06), 0 1px 2px -1px rgb(35 20 10 / 0.06)",
        md: "0 4px 10px -2px rgb(35 20 10 / 0.07), 0 2px 4px -2px rgb(35 20 10 / 0.05)",
        lg: "0 10px 22px -6px rgb(35 20 10 / 0.09), 0 4px 8px -4px rgb(35 20 10 / 0.05)",
      },
    },
  },

  plugins: [],
}