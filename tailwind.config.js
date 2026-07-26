/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0c0a09',
        surface: { DEFAULT: '#1c1917', raised: '#292524' },
        line: '#44403c',
        ceiling: '#fb923c',
      },
      fontFamily: {
        display: ['Barlow Condensed', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
