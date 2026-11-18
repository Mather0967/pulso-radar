/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Midnight (derived from #11222C)
        ink: {
          950: '#060d12',
          900: '#0a151c',
          850: '#0d1a22',
          800: '#11222c',
          700: '#172d39',
          600: '#1e3846',
        },
        line: {
          DEFAULT: '#1d3340',
          soft: '#152833',
        },
        // Mandarina (accent)
        brand: {
          50: '#fff4ed',
          100: '#ffe6d5',
          200: '#ffcaa9',
          300: '#ffa673',
          400: '#ff8a4c',
          500: '#ff762e',
          600: '#e6621b',
          700: '#bf4c12',
          800: '#983d14',
          900: '#7a3414',
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
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,118,46,0.35), 0 18px 60px -20px rgba(255,118,46,0.55)',
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
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        pulseDot: {
          '0%,100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.35)', opacity: '0.6' },
        },
        floatSlow: {
          '0%,100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        glowPulse: {
          '0%,100%': { boxShadow: '0 0 0 0 rgba(255,118,46,0.45)' },
          '50%': { boxShadow: '0 0 0 10px rgba(255,118,46,0)' },
        },
        gradientPan: {
          '0%': { backgroundPosition: '0% 50%' },
          '100%': { backgroundPosition: '100% 50%' },
        },
        typingDot: {
          '0%,60%,100%': { transform: 'translateY(0)', opacity: '0.4' },
          '30%': { transform: 'translateY(-4px)', opacity: '1' },
        },
      },
      animation: {
        shimmer: 'shimmer 4s linear infinite',
        float: 'float 7s ease-in-out infinite',
        pulseRing: 'pulseRing 2.4s ease-out infinite',
        fadeUp: 'fadeUp 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        fadeIn: 'fadeIn 0.5s ease-out both',
        slideInRight: 'slideInRight 0.5s cubic-bezier(0.2, 0.7, 0.2, 1) both',
        scaleIn: 'scaleIn 0.35s ease-out both',
        pulseDot: 'pulseDot 2s ease-in-out infinite',
        floatSlow: 'floatSlow 6s ease-in-out infinite',
        glowPulse: 'glowPulse 2.4s ease-in-out infinite',
        gradientPan: 'gradientPan 8s ease infinite alternate',
        typingDot: 'typingDot 1.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
