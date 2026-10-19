/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        ink: 'var(--ink)',
        soft: 'var(--ink-soft)',
        accent: 'var(--accent)',
      },
    },
  },
  plugins: [],
}
