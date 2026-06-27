/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f1f24",        // deep near-black teal (app shell)
        panel: "#13282f",      // sidebar / panels
        surface: "#1b3a43",    // raised surfaces
        accent: "#0fb5a0",     // teal accent (sent bubbles, buttons)
        "accent-dim": "#0c8d7e",
        bubble: "#21464f",     // received bubble
        muted: "#7fa6a8",      // secondary text
      },
      fontFamily: {
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
