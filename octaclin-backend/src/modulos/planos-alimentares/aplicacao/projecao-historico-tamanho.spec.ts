import { gzipSync } from 'node:zlib';
import { construirAnaliseFactual } from './construtor-analise-factual';
import { projetarResumoHistoricoFactual, projetarRegistroFactual } from './projecao-registro-factual';
import { prepararRelatorioFactual } from './relatorio-analise-factual';
import { resumirFontesRegistro } from './fontes-relatorio-factual';
import { analisarFontesPorNutriente } from '../dominio/fontes-por-nutriente';
import { criarSnapshotMicronutrientes, CODIGOS_MICRONUTRIENTES } from '../dominio/micronutrientes';

/**
 * MEDIÇÃO do tamanho das respostas com origem por nutriente (FOOD06 M01).
 * Não há teto de resposta no BFF nem no backend (os limites existentes são de corpo de pedido: 16 KiB no BFF e
 * 100 KiB no backend); o único limite do lado do servidor é de 10 MiB de texto cifrado lido por página de histórico.
 * Este spec mede três cenários e fixa um ORÇAMENTO, para que o crescimento seja uma decisão e não uma surpresa.
 * Para ver os números: MEDIR_TAMANHO=true pnpm exec jest <este arquivo>.
 */
const TODOS_CONHECIDOS = Object.fromEntries(CODIGOS_MICRONUTRIENTES.map(c => [c, { estado: 'conhecido' as const, valor: 1 }]));
const macros = { energiaKcal: 100, proteinasG: 10, carboidratosG: 10, gordurasG: 10 };
const HASH = 'c'.repeat(64);
const catalogo = (codigo: string, baseCodigo: string, versao: string) => ({
  origem: 'catalogo', codigoOrigem: 'ALIMENTO-SINTETICO', fonte: { codigo, baseCodigo, versao, hashConteudo: HASH, esquemaVersao: 'octaclin-composicao-v2-micros1' },
  nutrientesPor100g: macros, nutrientesPorcao: macros, micronutrientes: criarSnapshotMicronutrientes(TODOS_CONHECIDOS, 100, 100)
});
const digitado = (origem: 'manual' | 'custom') => ({ origem, nutrientesPor100g: macros, nutrientesPorcao: macros, micronutrientes: criarSnapshotMicronutrientes(TODOS_CONHECIDOS, 100, 100) });
const FONTES: [string, string][] = [['taco_nepa_unicamp', 'cmvcol_taco3'], ['usda_fdc_foundation', 'foundation-foods'], ['usda_fdc_sr_legacy', 'sr-legacy'], ['ibge_pof_2008_2009', 'pof-2008-2009-composicao']];
const registro = (itens: unknown[]) => construirAnaliseFactual({
  escopo: { tenantId: '10000000-0000-4000-8000-000000000005', pacienteId: '10000000-0000-4000-8000-000000000006' },
  origem: { planoId: '10000000-0000-4000-8000-000000000001', versaoId: '10000000-0000-4000-8000-000000000002', numero: 1, status: 'publicada', registradaEm: '2026-11-01T12:00:00.000Z' },
  ativo: true, selecionado: true,
  refeicoes: [{ identidadeId: '10000000-0000-4000-8000-000000000003', ativa: true, selecionada: true, itens: itens.map(snapshot => ({ porcaoGramas: 100, snapshot })) }]
});
const meta = { id: '10000000-0000-4000-8000-000000000004', criadoEm: new Date('2026-11-07T11:00:00.000Z') };
const bytes = (v: unknown) => Buffer.byteLength(JSON.stringify(v));

const CENARIOS: Record<string, () => unknown[]> = {
  // Plano comum: uma base oficial, uma segunda base e uma entrada manual.
  tipico: () => [catalogo(...FONTES[0]!, 'v1'), catalogo(...FONTES[1]!, 'v1'), digitado('manual')],
  // Catálogo com as 4 fontes em 3 versões cada, mais manual, personalizado e não catalogada: 15 grupos por nutriente.
  realistaAlto: () => [
    ...FONTES.flatMap(([c, b]) => ['v1', 'v2', 'v3'].map(v => catalogo(c, b, v))), digitado('manual'), digitado('custom'),
    { ...catalogo('outra_fonte', 'qualquer', 'x') }
  ],
  // Limite do contrato: 50 grupos detalhados por nutriente (mais itens em fontes adicionais).
  limiteDoContrato: () => Array.from({ length: 60 }, (_, i) => catalogo('usda_fdc_foundation', 'foundation-foods', `2025-${String(i + 1).padStart(2, '0')}`))
};
// Orçamento (bytes) para UMA página de 10 análises, medido (2026-11-08) com ~25% de folga. Subir um valor exige decisão.
// Medido: típico 120.104 / realista alto 302.274 / limite do contrato 971.934 com origem; ~58.800 sem origem.
const ORCAMENTO_PAGINA_COM_ORIGEM: Record<string, number> = { tipico: 150_000, realistaAlto: 380_000, limiteDoContrato: 1_220_000 };
// Quem não pede a origem (clientes anteriores) não pode ser afetado: a página fica no tamanho de antes.
const ORCAMENTO_PAGINA_SEM_ORIGEM = 70_000;

describe('tamanho das respostas com origem por nutriente', () => {
  const medidas: Record<string, Record<string, number>> = {};
  for (const [nome, itens] of Object.entries(CENARIOS)) {
    it(`${nome}: histórico (10 análises), relatório formato 2 e cálculo ao vivo cabem no orçamento`, () => {
      const r = registro(itens());
      const sem = projetarResumoHistoricoFactual(meta, r), com = projetarResumoHistoricoFactual(meta, r, undefined, false, true);
      const paginaSem = bytes({ schemaVersao: 1, itens: Array.from({ length: 10 }, () => sem), temMais: false });
      const paginaCom = bytes({ schemaVersao: 1, itens: Array.from({ length: 10 }, () => com), temMais: false });
      const projecao = projetarRegistroFactual(meta, r), agora = new Date('2026-11-07T13:00:00.000Z');
      const relatorio = bytes(prepararRelatorioFactual({ ...projecao, fontesComposicao: resumirFontesRegistro(r, true) }, agora, 2, true));
      const ao_vivo_fontes = bytes(analisarFontesPorNutriente([{ planoId: 'p', ativo: true, selecionado: true, refeicoes: [{ identidadeId: 'r', ativa: true, selecionada: true, itens: itens() }] }]));
      // ATENÇÃO: as 10 análises aqui são cópias idênticas; o gzip é só um LIMITE INFERIOR, não uma estimativa do tráfego real.
      const gz = gzipSync(JSON.stringify({ schemaVersao: 1, itens: Array.from({ length: 10 }, () => com), temMais: false })).byteLength;
      medidas[nome] = { paginaSem, paginaCom, paginaComGzip: gz, acrescimoPorPagina: paginaCom - paginaSem, relatorio, fontesAoVivo: ao_vivo_fontes };
      if (process.env.MEDIR_TAMANHO === 'true') console.info(`[tamanho] ${nome}: ${JSON.stringify(medidas[nome])}`);
      expect(paginaCom).toBeLessThanOrEqual(ORCAMENTO_PAGINA_COM_ORIGEM[nome]!);
      // A origem acrescenta, mas a página sem ela (clientes anteriores) não pode ter mudado de ordem de grandeza.
      expect(paginaSem).toBeLessThan(paginaCom);
      expect(paginaSem).toBeLessThanOrEqual(ORCAMENTO_PAGINA_SEM_ORIGEM);
      // Orçamento do relatório e da origem no cálculo ao vivo (uma resposta por vez).
      expect(relatorio).toBeLessThanOrEqual(nome === 'limiteDoContrato' ? 135_000 : nome === 'realistaAlto' ? 46_000 : 22_000);
      expect(ao_vivo_fontes).toBeLessThanOrEqual(nome === 'limiteDoContrato' ? 115_000 : nome === 'realistaAlto' ? 31_000 : 8_000);
      // Muito abaixo do único limite do servidor (10 MiB de texto cifrado lido por página).
      expect(paginaCom).toBeLessThan(10 * 1024 * 1024);
    });
  }
});
