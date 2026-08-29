/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: '#0F1420',
        surface: '#161C2C',
        surface2: '#1D2438',
        border: '#262E44',
        ink: '#E4E7EE',
        muted: '#8891A6',
        accent: '#F5A623',
        blocker: '#DC2626',
        critical: '#EF4444',
        major: '#F59E0B',
        normal: '#3B82F6',
        minor: '#22C55E',
        trivial: '#8891A6',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
}
