import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        status: {
          success: "#16a34a",
          warning: "#d97706",
          danger: "#dc2626",
          info: "#2563eb",
        },
      },
    },
  },
  plugins: [],
};

export default config;
