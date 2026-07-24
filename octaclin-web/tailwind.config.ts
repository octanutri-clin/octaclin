import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        fundo: '#F7F8FA',
        superficie: '#F8FAFB',
        tinta: '#1F2937',
        'texto-forte': '#343C4B',
        'texto-suave': '#596273',
        'texto-sutil': '#8A94A3',
        linha: '#D9DEE8',
        primaria: '#247BA0',
        'primaria-forte': '#1D6684',
        'primaria-suave': '#EAF3F7',
        'superficie-hover': '#EEF3F6',
        sucesso: '#2F9E44',
        'sucesso-forte': '#245B33',
        'sucesso-suave': '#EEF7F0',
        'sucesso-borda': '#B8DFC1',
        alerta: '#C77D1A',
        'alerta-forte': '#7A5A00',
        'alerta-suave': '#FFFAF0',
        'alerta-borda': '#E6D6A8',
        perigo: '#C0392B',
        'perigo-forte': '#A93226',
        'perigo-suave': '#FFF4F1',
        'perigo-borda': '#EFB8AD'
      },
      borderRadius: {
        lg: '8px',
        md: '6px',
        sm: '4px'
      },
      fontFamily: {
        heading: ['var(--font-figtree)', 'system-ui', 'sans-serif'],
        body: ['var(--font-noto-sans)', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};

export default config;
