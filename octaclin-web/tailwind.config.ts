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
        // 3.07:1 sobre branco e 2.74:1 sobre superficie-hover: passa o minimo de
        // 3:1 de componente grafico (WCAG 1.4.11), mas NAO o de 4.5:1 de texto
        // (1.4.3). Use apenas em icone/decoracao; para texto use `texto-suave`.
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
        'perigo-borda': '#EFB8AD',
        neutro: {
          50: '#F7F8FA',
          100: '#EEF1F4',
          200: '#E3E7ED',
          300: '#D9DEE8',
          400: '#B8C0CE',
          500: '#8A94A3',
          600: '#596273',
          700: '#3F4757',
          800: '#2A3140',
          900: '#1B2130',
          950: '#11151F'
        }
      },
      borderRadius: {
        xl: '16px',
        lg: '12px',
        md: '8px',
        sm: '6px'
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.35' }],
        sm: ['0.875rem', { lineHeight: '1.5' }],
        md: ['0.9375rem', { lineHeight: '1.5' }],
        base: ['1rem', { lineHeight: '1.5' }],
        lg: ['1.125rem', { lineHeight: '1.4' }],
        xl: ['1.25rem', { lineHeight: '1.35' }],
        '2xl': ['1.5rem', { lineHeight: '1.3' }]
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgba(31, 41, 55, 0.06)',
        lg: '0 8px 24px -4px rgba(31, 41, 55, 0.16), 0 2px 8px -2px rgba(31, 41, 55, 0.08)',
        cartao:
          'inset 0 0 0 1px rgba(217, 222, 232, 0.6), 0 1px 2px 0 rgba(31, 41, 55, 0.06), 0 1px 3px 1px rgba(31, 41, 55, 0.08)'
      },
      spacing: {
        campo: '0.75rem',
        cartao: '1.25rem',
        secao: '2rem'
      },
      fontFamily: {
        heading: ['var(--font-plex-sans)', 'system-ui', 'sans-serif'],
        body: ['var(--font-plex-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'ui-monospace', 'monospace']
      }
    }
  },
  plugins: []
};

export default config;
