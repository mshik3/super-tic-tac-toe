/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        arena: {
          bg: "#080C14",
          surface: "#0E1525",
          "surface-2": "#151E30",
          "surface-3": "#1C2A3E",
          border: "#1D2A3F",
          "border-2": "#263550",
          text: "#B8C5D8",
          dim: "#4D6080",
          "dim-2": "#324258",
        },
        x: {
          DEFAULT: "#00CCFF",
          bright: "#40DFFF",
          muted: "#0099CC",
        },
        o: {
          DEFAULT: "#FF4444",
          bright: "#FF7070",
          muted: "#CC2222",
        },
        gold: {
          DEFAULT: "#F0B500",
          dim: "#7A5C00",
        },
        // Keep old colors for any leftover usages
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          500: "#0ea5e9",
          600: "#0284c7",
          700: "#0369a1",
        },
        gray: {
          50: "#f9fafb",
          100: "#f3f4f6",
          200: "#e5e7eb",
          300: "#d1d5db",
          400: "#9ca3af",
          500: "#6b7280",
          600: "#4b5563",
          700: "#374151",
          800: "#1f2937",
          900: "#111827",
        },
      },
      fontFamily: {
        display: ["Rajdhani", "system-ui", "sans-serif"],
        sans: ["Rajdhani", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "Consolas", "monospace"],
      },
      boxShadow: {
        "x-glow": "0 0 20px rgba(0, 204, 255, 0.35)",
        "o-glow": "0 0 20px rgba(255, 68, 68, 0.35)",
        "x-glow-sm": "0 0 10px rgba(0, 204, 255, 0.25)",
        "o-glow-sm": "0 0 10px rgba(255, 68, 68, 0.25)",
      },
    },
  },
  plugins: [],
};
