import animate from 'tailwindcss-animate'
import defaultTheme from 'tailwindcss/defaultTheme.js'

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        rivect: {
          medianoche: '#0a151c',
          'medianoche-2': '#11222c',
          'surface-2': '#172d39',
          pizarra: '#405c6b',
          mandarin: '#ff762e',
          'mandarin-hover': '#e6621b',
          cream: '#f7f5ef',
          ink: '#f7f5ef',
          'ink-2': '#c4d0d7',
          'ink-3': '#8aa2b0',
        },
        project: {
          pulso: 'hsl(var(--project-pulso))',
          landur: 'hsl(var(--project-landur))',
          studio: 'hsl(var(--project-studio))',
          retail: 'hsl(var(--project-retail))',
          general: 'hsl(var(--project-general))',
        },
        status: {
          pending: 'hsl(var(--status-pending))',
          progress: 'hsl(var(--status-progress))',
          done: 'hsl(var(--status-done))',
          blocked: 'hsl(var(--status-blocked))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        hover: 'var(--shadow-hover)',
      },
      transitionTimingFunction: {
        spring: 'var(--ease-spring)',
        out: 'var(--ease-out)',
        soft: 'var(--ease-soft)',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', ...defaultTheme.fontFamily.sans],
        mono: ['"JetBrains Mono"', ...defaultTheme.fontFamily.mono],
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        orbFloat: {
          '0%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(-36px, 52px) scale(1.07)' },
          '100%': { transform: 'translate(30px, -40px) scale(0.95)' },
        },
        gridBreath: {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        borderSpin: {
          from: { transform: 'rotate(0deg)' },
          to: { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        'orb-float': 'orbFloat 22s ease-in-out infinite alternate',
        'grid-breath': 'gridBreath 9s ease-in-out infinite',
        'border-spin': 'borderSpin 5s linear infinite',
      },
    },
  },
  plugins: [animate],
}
