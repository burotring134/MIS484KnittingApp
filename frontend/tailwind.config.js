/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        pastel: {
          pink:   '#FFD6E0',
          purple: '#C8B2E6',
          blue:   '#A8D4F5',
          green:  '#B8E8D4',
          yellow: '#FFF3C4',
          peach:  '#FFDDC1',
        },
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
      },
    },
  },
  plugins: [],
};
