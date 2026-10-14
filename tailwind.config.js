/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        page: "#0d1014",
        bar: "#080a0d",
        panel: "#151a20",
        strip: "#1b2129",
        well: "#0a0d10",
        line: "#2a323d",
        "line-strong": "#4a5566",
        ink: "#d4dbe4",
        muted: "#8490a0",
        accent: { DEFAULT: "#3f78b5", soft: "#1a2838" },
        x: { DEFAULT: "#5ea6f2", soft: "#18283b", hover: "#25415f" },
        o: { DEFAULT: "#f06a5e", soft: "#3a1c1b", hover: "#4d2624" },
        warn: { DEFAULT: "#e2b54e", soft: "#2a2212", line: "#6a5424" },
        ok: "#3fb950",
        cell: { DEFAULT: "#11151a", live: "#222a34" },
        btn: { top: "#2a313b", bottom: "#1f252d", edge: "#3b4552" },
      },
      fontFamily: {
        sans: ["Verdana", "Geneva", "Tahoma", "sans-serif"],
        mono: ["ui-monospace", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
