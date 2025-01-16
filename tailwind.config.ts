import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",  // All source files
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",  // Next.js app directory
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",  // Components
  ],
  theme: {
    extend: {
      colors: {
        margarita: "#AADF46",    // Primary accent
        teal: "#03B5AA",         // Secondary accent
        orange: "#FF9F40",       // Tertiary accent
        pink: "#FF6F91",         // Highlight
        light: "#F7F7F7",        // Light background
        charcoal: "#333333",     // Text color
      },
    },
  },
  plugins: [],
};

export default config;
