/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#161618",
        surface: "#1C1C1E",
        primary: "#6366F1",
        secondary: "#818CF8",
        paid: "#34D399",
        overdue: "#F87171",
        border: "rgba(255,255,255,0.07)",
        textPrimary: "#FFFFFF",
        textMuted: "rgba(255,255,255,0.4)",
      },
      fontFamily: {
        caveat: ["Caveat_400Regular"],
        "caveat-bold": ["Caveat_700Bold"],
        quicksand: ["Quicksand_400Regular"],
        "quicksand-medium": ["Quicksand_500Medium"],
        "quicksand-bold": ["Quicksand_700Bold"],
      },
    },
  },
  plugins: [],
};
