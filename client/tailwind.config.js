/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'portfolio': {
          50: '#f0f4ff',
          100: '#e6ecff',
          200: '#c7d9ff',
          300: '#a8c5ff',
          400: '#6b9eff',
          500: '#2e78ff',
          600: '#1f5ae6',
          700: '#1844b2',
          800: '#122e7e',
          900: '#0c1e54',
        },
      },
    },
  },
  plugins: [],
}
