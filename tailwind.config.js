/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#0A0A0F',
          elevated: '#14141C',
          overlay: '#1C1C26',
          hover: '#22222E',
        },
        border: {
          subtle: 'rgba(255,255,255,0.06)',
          DEFAULT: 'rgba(255,255,255,0.10)',
          strong: 'rgba(255,255,255,0.16)',
        },
        accent: {
          DEFAULT: '#FFFFFF',
          hover: '#F5F5F7',
          glow: 'rgba(255,255,255,0.15)',
        },
        gold: {
          DEFAULT: '#FFD60A',
          muted: 'rgba(255,214,10,0.15)',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#A1A1AA',
          tertiary: '#52525B',
        },
        state: {
          success: '#22C55E',
          warning: '#EAB308',
          error: '#EF4444',
          live: '#EF4444',
        },
      },
      fontFamily: {
        display: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'accent-glow': '0 0 35px rgba(255,255,255,0.15)',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'apple': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
