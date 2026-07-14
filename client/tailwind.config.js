export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff8f5",
          100: "#fff3ee",
          500: "#F38978",
          600: "#e87562",
          700: "#c55245"
        },
        neon: {
          bg: "#fff8f5",
          deep: "#fff3ee",
          panel: "#fff0eb",
          purple: "#FDD9CD",
          lavender: "#fff6f2",
          pink: "#F38978",
          blue: "#2D7C83"
        }
      }
    }
  },
  plugins: []
};
