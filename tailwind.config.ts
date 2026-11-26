import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: {
          DEFAULT: '#071B22',
          50: '#eef4f4',
          100: '#d4e3e3',
          200: '#a6c5c6',
          300: '#719fa2',
          400: '#477a7e',
          500: '#2f5f63',
          600: '#254c50',
          700: '#1d3c40',
          800: '#122a2e',
          900: '#071B22',
          950: '#041217',
        },
        lime: {
          DEFAULT: '#C6F36A',
          50: '#f7fdea',
          100: '#edfbc9',
          200: '#dcf797',
          300: '#C6F36A',
          400: '#a9df3f',
          500: '#8bc521',
          600: '#6b9c17',
          700: '#517616',
          800: '#425e18',
          900: '#384f19',
        },
        mint: {
          DEFAULT: '#EAF5EA',
          50: '#f6faf6',
          100: '#EAF5EA',
          200: '#d3e8d4',
          300: '#adcfaf',
          400: '#7cad7f',
          500: '#548a58',
          600: '#3f6e43',
          700: '#345737',
          800: '#2c472e',
          900: '#253b27',
        },
        charcoal: {
          DEFAULT: '#17272B',
          50: '#f2f5f5',
          100: '#e3e9e9',
          200: '#c7d3d3',
          300: '#a0b3b4',
          400: '#728d8f',
          500: '#567274',
          600: '#465c5e',
          700: '#3a4b4d',
          800: '#2b3a3c',
          900: '#17272B',
          950: '#0d1a1d',
        },
        muted: '#829194',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['Onest', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(7,27,34,0.04), 0 12px 32px -12px rgba(7,27,34,0.16)',
        float: '0 24px 60px -20px rgba(7,27,34,0.35)',
        glow: '0 0 40px -8px rgba(198,243,106,0.5)',
        sidebar: '0 20px 60px -20px rgba(7,27,34,0.4)',
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.75rem',
      },
      backgroundImage: {
        'grid-dark':
          'linear-gradient(rgba(198,243,106,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(198,243,106,0.06) 1px, transparent 1px)',
        'radial-lime': 'radial-gradient(circle at center, rgba(198,243,106,0.22), transparent 65%)',
      },
      keyframes: {
        pulseRing: {
          '0%': { transform: 'scale(0.85)', opacity: '0.8' },
          '70%': { transform: 'scale(1.4)', opacity: '0' },
          '100%': { transform: 'scale(1.4)', opacity: '0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        charge: {
          '0%': { width: '8%' },
          '60%': { width: '76%' },
          '100%': { width: '88%' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'pulse-ring': 'pulseRing 2.4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 1.8s infinite',
        charge: 'charge 3.5s ease-out forwards',
        marquee: 'marquee 38s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
