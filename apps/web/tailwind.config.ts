// Tailwind với token màu và font theo packages/ui/src/tokens.ts (hướng "Sáng và rõ").
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F3F6F4', surface: '#FFFFFF', ink: '#0F1F1D', ink2: '#34423F', ink3: '#56635F', line: '#DCE3E1', line2: '#CBD5D2',
        primary: '#0B6F75', 'primary-soft': '#DDF1F1', 'primary-text': '#0B5C61',
        accent: '#C2410C', 'accent-soft': '#FFEDD5', 'accent-text': '#9A3412', teal: '#0B6F75', 'teal-soft': '#DDF1F1', 'teal-text': '#0B5C61',
        side: '#0C3A3E', 'side-text': '#BFE3E1', 'side-muted': '#8DBAB8', gold: '#F5B841', 'gold-soft': '#FBF0D2', 'gold-text': '#7A5C14',
      },
      fontFamily: { display: ['Be Vietnam Pro', 'Segoe UI', 'system-ui', 'sans-serif'], sans: ['Be Vietnam Pro', 'Segoe UI', 'system-ui', 'sans-serif'] },
      borderRadius: { xl2: '16px' },
    },
  },
  plugins: [],
} satisfies Config;
