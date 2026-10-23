/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#eff7f2',
          100: '#d8ecdf',
          200: '#b4d9c2',
          300: '#84be9d',
          400: '#519d74',
          500: '#2f8058',
          600: '#206645',
          700: '#1a5239',
          800: '#16412f',
          900: '#123528',
          950: '#091f18',
        },
        slate: {
          925: '#111b24',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 28px -18px rgba(15, 23, 42, 0.28)',
        float: '0 18px 50px -20px rgba(15, 23, 42, 0.35)',
      },
    },
  },
  plugins: [],
};
