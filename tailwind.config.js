/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        base: '#111111',
        card: '#1E1E1E',
        cardsoft: '#262626',
        line: '#2E2E2E',
        accent: { DEFAULT: '#EC4899', dark: '#C22A75', soft: '#F472B6' },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
