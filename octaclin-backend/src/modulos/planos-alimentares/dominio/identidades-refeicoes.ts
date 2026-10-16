/** O payload inteiro é cifrado em repouso: a chave editorial é dado protegido.
 * UUIDs operacionais não derivam do nome, posição ou conteúdo clínico. */
export type AliasIdentidadeRefeicao = [chave: string, identidade: string];
const LIMITE_ALIASES = 4096;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function falhar(): never { throw new Error('Identidades de refeições indisponíveis.'); }

export function lerIdentidadesRefeicoes(json: string): AliasIdentidadeRefeicao[] {
  if (Buffer.byteLength(json, 'utf8') > 1024 * 1024) falhar();
  const valor: unknown = JSON.parse(json);
  if (!valor || typeof valor !== 'object' || !('schemaVersao' in valor) || valor.schemaVersao !== 1 ||
      !('aliases' in valor) || !Array.isArray(valor.aliases) || valor.aliases.length > LIMITE_ALIASES) falhar();
  const chaves = new Set<string>();
  const resultado: AliasIdentidadeRefeicao[] = [];
  for (const alias of valor.aliases) {
    if (!Array.isArray(alias) || alias.length !== 2 || typeof alias[0] !== 'string' ||
        !alias[0].trim() || alias[0].length > 100 || typeof alias[1] !== 'string' || !UUID.test(alias[1]) || chaves.has(alias[0])) falhar();
    chaves.add(alias[0]); resultado.push([alias[0], alias[1]]);
  }
  return resultado;
}

export function prepararIdentidadesRefeicoes(
  chaves: string[], anteriores: AliasIdentidadeRefeicao[], gerarId: () => string
): { aliases: AliasIdentidadeRefeicao[]; identidades: string[] } {
  const mapa = new Map(lerIdentidadesRefeicoes(JSON.stringify({schemaVersao: 1, aliases: anteriores})));
  const usadas = new Set<string>();
  const identidades = chaves.map(chave => {
    if (typeof chave !== 'string' || !chave.trim() || chave.length > 100) falhar();
    const identidade = mapa.get(chave) ?? gerarId();
    if (!UUID.test(identidade) || usadas.has(identidade)) falhar();
    usadas.add(identidade); mapa.set(chave, identidade);
    return identidade;
  });
  if (mapa.size > LIMITE_ALIASES) falhar();
  const aliases = Array.from(mapa.entries());
  // O limite também vale após adicionar chaves, antes de persistir um mapa que
  // o próximo acesso recusaria. Tamanho em bytes, não apenas número de entradas.
  lerIdentidadesRefeicoes(JSON.stringify({schemaVersao: 1, aliases}));
  return { aliases, identidades };
}
