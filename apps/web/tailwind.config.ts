// Tailwind với token màu và font từ design/build.mjs.
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F7F3EC', surface: '#FFFDF9', ink: '#1F1B17', ink2: '#5C554D', ink3: '#8C8478', line: '#E8E1D6', line2: '#E3DCD0',
        accent: '#D4593A', 'accent-soft': '#FBE9E2', 'accent-text': '#9C3A21', teal: '#0E8E96', 'teal-soft': '#DDF1F1', 'teal-text': '#0B6F75',
        side: '#25201B', 'side-text': '#CFC6B8', 'side-muted': '#8C8478', gold: '#C89B3C', 'gold-soft': '#F8EFD9', 'gold-text': '#8A6A1E',
      },
      fontFamily: { display: ['Montserrat', 'Segoe UI', 'Arial', 'sans-serif'], sans: ['Open Sans', 'Segoe UI', 'system-ui', 'sans-serif'] },
      borderRadius: { xl2: '16px' },
    },
  },
  plugins: [],
} satisfies Config;
