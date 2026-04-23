import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './contexts/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: '#DDE5EE',
        'border-strong': '#BFCBDA',
        input: '#DDE5EE',
        ring: '#2764ff',
        background: '#F2F8FF',
        foreground: '#191b24',
        primary: {
          DEFAULT: '#004bd9',
          foreground: '#ffffff',
          container: '#2764ff',
        },
        secondary: {
          DEFAULT: '#b70051',
          container: '#e01b68',
        },
        surface: {
          DEFAULT: '#faf8ff',
          raised: '#FFFFFF',
          container: '#ededfa',
          'container-low': '#f3f2ff',
          'container-high': '#e7e7f4',
          'container-lowest': '#ffffff',
        },
        ink: '#03182F',
        'on-surface': '#191b24',
        'foreground-muted': '#30373E',
        'foreground-subtle': '#6B7480',
        ok: '#3FA46A',
        warn: '#E0A93A',
        error: '#ba1a1a',
        urgent: '#F22E75',
        'urgent-soft': '#FFE7EC',
        card: {
          DEFAULT: '#FFFFFF',
          foreground: '#191b24',
        },
        muted: {
          DEFAULT: '#ededfa',
          foreground: '#6B7480',
        },
      },
      fontFamily: {
        serif: ['Noto Serif', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '0.125rem',
        lg: '0.25rem',
        xl: '0.5rem',
        '2xl': '0.75rem',
      },
    },
  },
  plugins: [require('tailwindcss-animate'), require('tailwind-scrollbar-hide')],
}

export default config
