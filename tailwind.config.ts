import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "deep-violet": "#4C1D95",
        "electric-blue": "#2563EB",
      },
      backgroundImage: {
        "gradient-resonans":
          "linear-gradient(135deg, #4C1D95 0%, #2563EB 100%)",
      },
      animation: {
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "wave": "wave 1.5s ease-out infinite",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.85" },
        },
        wave: {
          "0%": { transform: "scale(0.8)", opacity: "0.6" },
          "100%": { transform: "scale(1.5)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
