import type { Config } from "tailwindcss"


export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "rgb(var(--surface) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        border: "rgb(var(--border) / <alpha-value>)",
      },
      boxShadow: {
        panel: "0 18px 45px -25px rgba(18, 38, 63, 0.45)",
      },
      fontFamily: {
        display: ['"Iowan Old Style"', '"Palatino Linotype"', "Book Antiqua", "Georgia", "serif"],
        body: ['"Avenir Next"', '"Segoe UI"', "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config
