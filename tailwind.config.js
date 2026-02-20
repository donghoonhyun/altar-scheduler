/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class", // 🔑 class 기반 다크 모드
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Pretendard", "-apple-system", "BlinkMacSystemFont", "system-ui", "Roboto", "sans-serif"],
        gamja: ["'Gamja Flower'", "cursive"],
      },
    },
  },
  plugins: [],
};
