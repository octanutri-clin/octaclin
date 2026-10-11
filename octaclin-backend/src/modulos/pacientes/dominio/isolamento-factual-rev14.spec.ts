import { readFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import ts from 'typescript';

/** Inclui imports de tipos e exports conservadoramente. */
function dependencias(raiz: string, carregar: (arquivo: string) => string | undefined, resolver: (nome: string, arquivo: string) => string | undefined): Set<string> {
  const visitados = new Set<string>();
  const visitar = (arquivo: string) => {
    if (visitados.has(arquivo)) return;
    visitados.add(arquivo);
    const conteudo = carregar(arquivo);
    if (conteudo === undefined) throw new Error('Fonte local da fronteira de produção não encontrada.');
    for (const entrada of ts.preProcessFile(conteudo, true, true).importedFiles) {
      const destino = resolver(entrada.fileName, arquivo);
      if (destino) visitar(destino);
    }
  };
  visitar(raiz);
  return visitados;
}

describe('REV14: entrega factual sem consumidores assistenciais de classificadores', () => {
  it('inspeciona dependências transitivas, ciclos e import dinâmico', () => {
    const fontes: Record<string, string> = { main: "import './servico';", servico: "export * from './apoio';", apoio: "import('./classificador'); import './servico';", classificador: 'export const x = 1;' };
    const r = dependencias('main', f => fontes[f], n => n.replace('./', ''));
    expect([...r]).toEqual(['main', 'servico', 'apoio', 'classificador']);
  });
  it('grafo real de main não importa núcleos experimentais ou pesquisas', () => {
    const raiz = resolve(__dirname, '../../../..');
    const config = ts.readConfigFile(resolve(raiz, 'tsconfig.json'), ts.sys.readFile);
    const opcoes = ts.parseJsonConfigFileContent(config.config, ts.sys, raiz).options;
    const r = dependencias(resolve(raiz, 'src/main.ts'), f => ts.sys.readFile(f), (nome, arquivo) => {
      const destino = ts.resolveModuleName(nome, arquivo, opcoes, ts.sys).resolvedModule?.resolvedFileName;
      return destino && destino.startsWith(resolve(raiz, 'src') + sep) ? destino : undefined;
    });
    const nomes = [...r].map(f => relative(raiz, f).split(sep).join('/'));
    expect(nomes).toContain('src/modulos/pacientes/aplicacao/servico-pacientes.ts');
    expect(nomes.some(n => /classificador-pediatrico-isolado|indicadores-pediatricos-candidatos|politica-prematuridade-candidata|protocolo-pediatrico-rev9|intergrowth-investigacao|validacao-rev11-investigacao/.test(n))).toBe(false);
    expect(readFileSync(resolve(raiz, 'src/modulos/pacientes/dominio/antropometria-pediatrica.ts'), 'utf8')).not.toMatch(/process\.env|escoreZ:|percentil:/);
  });
});
