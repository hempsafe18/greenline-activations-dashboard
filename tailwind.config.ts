import type { Config } from "tailwindcss";

// Scoped to the /profiles ambassador directory only. Preflight is disabled
// so this doesn't reset base element styles on the rest of the app, which
// relies on its own hand-rolled CSS.
const config: Config = {
  content: ["./app/profiles/**/*.{ts,tsx}"],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        bone: "#FAF0EA",
        ink: "#0A0A0A",
        canopy: "#00C853",
        street: "#FF4F33",
        mist: "#F5F5F5",
        sage: "#E8F5E9",
      },
      fontFamily: {
        sans: ["Manrope", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 8px rgba(10,10,10,0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
