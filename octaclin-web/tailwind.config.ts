import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fundo: '#F7F8FA',
        tinta: '#1F2937',
        linha: '#D9DEE8',
        primaria: '#247BA0',
        sucesso: '#2F9E44',
        alerta: '#C77D1A',
        perigo: '#C0392B'
      },
      borderRadius: {
        lg: '8px',
        md: '6px',
        sm: '4px'
      }
    }
  },
  plugins: []
};

export default config;
