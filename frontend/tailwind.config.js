/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: "#0F1216",
          900: "#14171C",
          800: "#1B1F26",
          700: "#242933",
          600: "#333A47",
          500: "#4A5361",
        },
        mist: {
          100: "#E7E9EC",
          300: "#AFB6C2",
          500: "#8B93A1",
        },
        cobalt: {
          400: "#5B8CFF",
          500: "#3E7BFA",
          600: "#2E5FD1",
        },
        amber: {
          400: "#F7B84B",
          500: "#F5A623",
        },
      },
      fontFamily: {
        display: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
