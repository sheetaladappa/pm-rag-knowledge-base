/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#12181f",
          900: "#1a232c",
          800: "#243040",
          700: "#334155",
        },
        parchment: {
          50: "#f7f4ec",
          100: "#efe9d8",
        },
        moss: {
          400: "#7b9b7d",
          500: "#5c7a5e",
          600: "#476048",
        },
        rust: {
          400: "#cf7358",
          500: "#b5573a",
        },
      },
      fontFamily: {
        display: ["'Source Serif 4'", "Georgia", "serif"],
        body: ["'Inter'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
