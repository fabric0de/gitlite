import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{svelte,ts}'],
  theme: {
    extend: {
      fontFamily: {
        ui: ['var(--font-ui)'],
        mono: ['var(--font-mono)']
      }
    }
  },
  plugins: []
};

export default config;
