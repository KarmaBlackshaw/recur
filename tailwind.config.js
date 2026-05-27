/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#0F172A",
        surface: "#101A34",
        primary: "#1E40AF",
        secondary: "#3B82F6",
        paid: "#059669",
        overdue: "#DC2626",
        border: "rgba(255,255,255,0.08)",
        textPrimary: "#FFFFFF",
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
