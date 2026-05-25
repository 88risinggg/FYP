export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f6e8ff",
          100: "#ead1ff",
          500: "#9D4EDD",
          600: "#7B2FF7",
          700: "#5f1fd1"
        },
        neon: {
          bg: "#090014",
          deep: "#120022",
          panel: "#1A0033",
          purple: "#9D4EDD",
          lavender: "#C77DFF",
          pink: "#FF4DDB",
          blue: "#4CC9F0"
        }
      }
    }
  },
  plugins: []
};
