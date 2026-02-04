/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'paper': '#F2F0E9',        // Archival paper tone
        'ink': '#050505',          // Velvety black
        'correction': '#FF2400',   // Correction red - emphasis only
        'file-tab': '#D4C9B5',     // Aged folder tab color
      },
      fontFamily: {
        'sans': ['Triplicate', 'ui-sans-serif', 'system-ui'],
        'serif': ['Neue Haas Grotesk', 'ui-serif', 'Georgia'],
        'mono': ['Triplicate', 'ui-monospace', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 8s linear infinite',
      },
      borderWidth: {
        '1': '1px',
        '2': '2px',
      }
    },
  },
  plugins: [],
}
