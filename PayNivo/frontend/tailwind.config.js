/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fff1f7",
          100: "#ffe4f0",
          600: "#e83f92",
          700: "#bd1f72"
        },
        plum: {
          900: "#22151f",
          800: "#301827"
        }
      }
    }
  },
  plugins: []
};
