import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { 700: '#1B2A4A', 900: '#0B1226' },
        kame: { yellow: '#FFC83D', blue: '#2BB6F5', cyan: '#7DE3FF' },
        rec: '#FF5A5F',
      },
      fontFamily: {
        sans: ['var(--font-fredoka)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 40px 8px rgba(125, 227, 255, 0.45)',
      },
      keyframes: {
        pop: {
          '0%': { transform: 'scale(1.6)', opacity: '0' },
          '30%': { opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '0.9' },
        },
      },
      animation: {
        pop: 'pop 1s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
