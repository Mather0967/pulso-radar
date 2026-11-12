/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#04060c',
          900: '#070b14',
          850: '#090e19',
          800: '#0b1120',
          700: '#111a2e',
          600: '#182338',
        },
        line: {
          DEFAULT: '#1a2337',
          soft: '#141d2e',
        },
        brand: {
          50: '#eef4ff',
          100: '#dbe8ff',
          200: '#b9d3ff',
          300: '#8ab5ff',
          400: '#5b95ff',
          500: '#2f74ff',
          600: '#1a56e8',
          700: '#1543b8',
          800: '#163a8f',
          900: '#122e6e',
        },
        mint: {
          400: '#4ade9f',
          500: '#22c98a',
        },
        amber: {
          400: '#f7bd54',
          500: '#e8a733',
        },
        coral: {
          400: '#ff7a7a',
          500: '#ef5b5b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(47,116,255,0.35), 0 18px 60px -20px rgba(47,116,255,0.55)',
        card: '0 24px 60px -32px rgba(0,0,0,0.9)',
      },
      backgroundImage: {
        'grid-soft':
          'linear-gradient(to right, rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.035) 1px, transparent 1px)',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '200% 50%' },
          '100%': { backgroundPosition: '-100% 50%' },
        },
        float: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseRing: {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        shimmer: 'shimmer 4s linear infinite',
        float: 'float 7s ease-in-out infinite',
        pulseRing: 'pulseRing 2.4s ease-out infinite',
      },
    },
  },
  plugins: [],
}
