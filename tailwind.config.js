/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['Triplicate', 'ui-sans-serif', 'system-ui'],
        'serif': ['Neue Haas Grotesk', 'ui-serif', 'Georgia'],
        'mono': ['Triplicate', 'ui-monospace', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
      },
    },
  },
  plugins: [],
}
