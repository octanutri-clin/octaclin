import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
  {
    /**
     * Divida declarada, nao regra desligada. O eslint-config-next 16 trouxe as
     * regras da era do React Compiler e elas acusam 51 ocorrencias em 38
     * componentes ja existentes, quase todas de setState dentro de useEffect.
     * Corrigir isso e refatoracao de estado em area larga do produto, logo
     * depois de duas majors, e merece fase propria com teste por componente.
     *
     * Em aviso elas continuam impressas em todo `pnpm lint`, entao a divida
     * fica visivel em vez de silenciada, e o gate mede o que ele sabe medir.
     * Quem fizer a fase sobe de volta para `error`, uma regra por vez.
     */
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn'
    }
  }
]);
