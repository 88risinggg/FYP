export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#FFF8F5",
          100: "#FFF3EE",
          200: "#FDD9CD",
          500: "#F38978",
          600: "#E87562",
          700: "#C55245"
        },
        surface: {
          DEFAULT: "#FFFFFF",
          page: "#FFF8F5",
          secondary: "#FFF3EE",
          panel: "#FFF0EB",
          highlight: "#FFF6F2",
          soft: "#FFFAF8"
        },
        ink: {
          DEFAULT: "#251E1F",
          secondary: "#514440",
          navigation: "#6F4F47",
          subtle: "#6F5B55",
          muted: "#7B6660",
          placeholder: "#9C7B72"
        },
        warmBorder: {
          DEFAULT: "#F0D2CA",
          control: "#EAD3CC",
          alternate: "#EAD6CF",
          structure: "#F2D5CC",
          dashed: "#F0C9BF"
        },
        secondary: {
          teal: "#2D7C83"
        },
        status: {
          draftBg: "#F2EEE9",
          draftText: "#6F5B55",
          sentBg: "#EAF2FF",
          sentText: "#3269A8",
          viewedBg: "#E7F7F5",
          viewedText: "#218178",
          successBg: "#E9F7EF",
          successBorder: "#B8D9C6",
          successText: "#2F8758",
          warningBg: "#FFF4D8",
          warningBorder: "#F4D59A",
          warningText: "#9A6412",
          errorBg: "#FFF0EB",
          errorBorder: "#F3C6BC",
          errorText: "#C94C3A",
          dangerText: "#D84E40"
        },
        neon: {
          bg: "#FFF8F5",
          deep: "#FFF3EE",
          panel: "#FFF0EB",
          purple: "#FDD9CD",
          lavender: "#FFF6F2",
          pink: "#F38978",
          blue: "#2D7C83"
        }
      },
      borderRadius: {
        control: "0.5rem",
        card: "0.75rem"
      },
      boxShadow: {
        card: "0 10px 28px rgba(37,30,31,0.06)",
        dropdown: "0 18px 45px rgba(37,30,31,0.16)",
        modal: "0 24px 70px rgba(37,30,31,0.18)",
        primary: "0 12px 25px rgba(243,137,120,0.25)",
        glass: "0 18px 48px rgba(37,30,31,0.08), 0 0 28px rgba(243,137,120,0.08)"
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif"
        ]
      }
    }
  },
  plugins: []
};
