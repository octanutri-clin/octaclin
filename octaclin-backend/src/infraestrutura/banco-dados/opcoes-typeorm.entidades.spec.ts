import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { criarOpcoesTypeOrm } from './opcoes-typeorm';

/**
 * Achado ao registrar `AgendaRecorrenciaOrm` (PB-19, Fase 277): TipoAtendimentoOrm e
 * ExpedienteProfissionalOrm (PB-18, Fase 276) nunca foram adicionadas ao array `entities`
 * de `criarOpcoesTypeOrm`, apesar de registradas em `TypeOrmModule.forFeature` no
 * modulo. Como nenhum servico usa `@InjectRepository` -- tudo passa por
 * `ExecutorTenant.executar(tenantId, gerenciador => gerenciador.getRepository(X))` -- o app
 * sobe normalmente e os testes de servico (que mockam `getRepository`) passam, mas uma
 * chamada real a `gerenciador.getRepository(X)` contra o DataSource de verdade lancaria
 * `EntityMetadataNotFoundError` em producao. Este teste fecha esse ponto cego: qualquer
 * classe exportada de um `*.orm.ts` precisa aparecer em `entities`.
 */
function listarArquivosOrm(diretorio: string): string[] {
  const resultado: string[] = [];
  for (const nome of readdirSync(diretorio)) {
    const caminho = join(diretorio, nome);
    if (statSync(caminho).isDirectory()) {
      resultado.push(...listarArquivosOrm(caminho));
    } else if (nome.endsWith('.orm.ts') && !nome.endsWith('.spec.ts')) {
      resultado.push(caminho);
    }
  }
  return resultado;
}

describe('entidades ORM registradas no DataSource', () => {
  it('toda classe exportada de um *.orm.ts aparece em entities de criarOpcoesTypeOrm', () => {
    const raizModulos = join(__dirname, '..', '..', 'modulos');
    const arquivos = listarArquivosOrm(raizModulos);
    expect(arquivos.length).toBeGreaterThan(10);

    const opcoes = criarOpcoesTypeOrm();
    const entidadesRegistradas = new Set(opcoes.entities as unknown[]);

    const faltando: string[] = [];
    for (const arquivo of arquivos) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const modulo = require(arquivo.replace(/\.ts$/, ''));
      for (const [nomeExport, valor] of Object.entries(modulo)) {
        if (typeof valor === 'function' && /Orm$/.test(nomeExport) && !entidadesRegistradas.has(valor)) {
          faltando.push(`${arquivo.replace(raizModulos, 'modulos')}: ${nomeExport}`);
        }
      }
    }

    expect(faltando).toEqual([]);
  });
});
