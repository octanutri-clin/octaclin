import { In } from 'typeorm';
import type { ExamesForaFaixaResumoDto } from './dtos';
import { ColetaExameLaboratorialOrm } from '../infraestrutura/coleta-exame-laboratorial.orm';
import { MarcadorExameLaboratorialOrm } from '../infraestrutura/marcador-exame-laboratorial.orm';
import { obterLeituraExamesResumo } from './leitura-exames-resumo';

type ColetaFalsa = Pick<ColetaExameLaboratorialOrm, 'id' | 'coletadaEm' | 'criadoEm'>;
type ResultadoFalso = Pick<MarcadorExameLaboratorialOrm,
  'id' | 'coletaId' | 'catalogoMarcadorId' | 'ordemExibicao' | 'resultadoCriptografado'>;
type LeituraDisponivel = Extract<ExamesForaFaixaResumoDto, { status: 'disponivel' }>;

function exigirDisponivel(resumo: ExamesForaFaixaResumoDto): LeituraDisponivel {
  if (resumo.status !== 'disponivel') throw new Error('Leitura esperada disponível.');
  return resumo;
}

function criarColeta(id: string, coletadaEm: string, ordem = 1): ColetaFalsa {
  return { id, coletadaEm, criadoEm: new Date(`2026-01-${String(ordem).padStart(2, '0')}T12:00:00Z`) };
}

function criarResultado(
  id: string,
  coletaId: string,
  dados: Record<string, unknown>,
  opcoes: { catalogoMarcadorId?: string; ordemExibicao?: number } = {}
): ResultadoFalso {
  return {
    id,
    coletaId,
    catalogoMarcadorId: opcoes.catalogoMarcadorId,
    ordemExibicao: opcoes.ordemExibicao ?? 0,
    resultadoCriptografado: Buffer.from(JSON.stringify(dados))
  };
}

function criarLeitor(coletas: ColetaFalsa[], resultados: ResultadoFalso[]) {
  const repositorioColetas = { find: jest.fn(async () => coletas) };
  const repositorioResultados = { find: jest.fn(async () => resultados) };
  const gerenciador = {
    getRepository: jest.fn((entidade: unknown) => {
      if (entidade === ColetaExameLaboratorialOrm) return repositorioColetas;
      if (entidade === MarcadorExameLaboratorialOrm) return repositorioResultados;
      throw new Error('Repositório inesperado.');
    })
  };
  const criptografia = {
    descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8'))
  };
  return {
    ler: () => obterLeituraExamesResumo(gerenciador as never, criptografia as never, 'tenant-a', 'paciente-a'),
    gerenciador,
    criptografia,
    repositorioColetas,
    repositorioResultados
  };
}

describe('resumo factual de resultados laboratoriais', () => {
  it('usa o último resultado por grupo antes de classificar e mantém catálogo e nomes livres separados', async () => {
    const coletas = [criarColeta('coleta-nova', '2026-08-12'), criarColeta('coleta-antiga', '2026-08-11')];
    const resultados = [
      criarResultado('ferritina-nova', 'coleta-nova', {
        nome: 'Ferritina', valor: '42', unidade: 'ng/mL', limiteInferior: '10', limiteSuperior: '40'
      }, { catalogoMarcadorId: 'catalogo-ferritina', ordemExibicao: 1 }),
      criarResultado('glicose-nova', 'coleta-nova', {
        nome: 'Glicose', valor: '85', unidade: 'mg/dL', limiteInferior: '70', limiteSuperior: '99'
      }, { ordemExibicao: 2 }),
      criarResultado('vitamina-d-nova', 'coleta-nova', {
        nome: 'Vit D', valor: '<5', unidade: 'ng/mL', limiteInferior: '20', limiteSuperior: '50'
      }, { ordemExibicao: 3 }),
      criarResultado('controle-1', 'coleta-nova', {
        nome: 'Controle sintético', valor: '8', unidade: 'g/L', metodo: 'Método 1', limiteInferior: '5', limiteSuperior: '10'
      }, { ordemExibicao: 4 }),
      criarResultado('controle-2', 'coleta-nova', {
        nome: 'Controle sintético', valor: '12', unidade: 'g/L', metodo: 'Método 1', limiteInferior: '5', limiteSuperior: '10'
      }, { ordemExibicao: 5 }),
      criarResultado('glicose-antiga', 'coleta-antiga', {
        nome: 'Glicose', valor: '120', unidade: 'mg/dL', limiteInferior: '70', limiteSuperior: '99'
      }, { ordemExibicao: 1 }),
      criarResultado('vitamina-d-antiga', 'coleta-antiga', {
        nome: 'Vit D', valor: '55', unidade: 'ng/mL', limiteInferior: '20', limiteSuperior: '50'
      }, { ordemExibicao: 2 })
    ];
    const leitor = criarLeitor(coletas, resultados);

    const resumo = exigirDisponivel(await leitor.ler());

    expect(resumo).toEqual({
      status: 'disponivel', coletasAnalisadas: 2, limiteColetas: 100, historicoTruncado: false,
      gruposAnalisados: 4, gruposNomeLivre: 3, semClassificacao: 1, duplicadosNaUltimaColeta: 1,
      totalForaFaixa: 1, itensLimitados: false,
      itens: [expect.objectContaining({
        resultadoId: 'ferritina-nova', coletaId: 'coleta-nova', origemAgrupamento: 'catalogo',
        nome: 'Ferritina', valor: '42', unidade: 'ng/mL', coletadaEm: '2026-08-12',
        limiteInferior: '10', limiteSuperior: '40'
      })]
    });
    expect(JSON.stringify(resumo)).not.toContain('glicose-antiga');
    expect(JSON.stringify(resumo)).not.toContain('resultadoCriptografado');
  });

  it('normaliza caixa e espaços de nome/método, sem converter unidade ou método', async () => {
    const coletas = [criarColeta('coleta-nova', '2026-08-12'), criarColeta('coleta-antiga', '2026-08-11')];
    const resultados = [
      criarResultado('nome-normalizado', 'coleta-nova', {
        nome: '  FERRITINA   ', valor: '30', unidade: 'ng/mL', metodo: '  METODO  A  ',
        limiteInferior: '10', limiteSuperior: '40'
      }, { ordemExibicao: 1 }),
      criarResultado('unidade-distinta', 'coleta-nova', {
        nome: 'Ferritina', valor: '42', unidade: 'NG/mL', limiteInferior: '10', limiteSuperior: '40'
      }, { ordemExibicao: 2 }),
      criarResultado('metodo-distinto', 'coleta-nova', {
        nome: 'Ferritina', valor: '43', unidade: 'ng/mL', metodo: 'Método A',
        limiteInferior: '10', limiteSuperior: '40'
      }, { ordemExibicao: 3 }),
      criarResultado('catalogo-independente', 'coleta-nova', {
        nome: 'Ferritina', valor: '44', unidade: 'ng/mL', limiteInferior: '10', limiteSuperior: '40'
      }, { catalogoMarcadorId: 'ferritina', ordemExibicao: 4 }),
      criarResultado('livre-antigo', 'coleta-antiga', {
        nome: 'Ferritina', valor: '50', unidade: 'ng/mL', metodo: 'metodo a',
        limiteInferior: '10', limiteSuperior: '40'
      }, { ordemExibicao: 1 })
    ];

    const resumo = exigirDisponivel(await criarLeitor(coletas, resultados).ler());

    expect(resumo).toMatchObject({ status: 'disponivel', gruposAnalisados: 4, totalForaFaixa: 3 });
    expect(resumo.itens?.map((item) => item.resultadoId)).toEqual([
      'unidade-distinta', 'metodo-distinto', 'catalogo-independente'
    ]);
  });

  it('limita a análise às 100 coletas e informa a presença de histórico anterior', async () => {
    const coletas = Array.from({ length: 101 }, (_, indice) =>
      criarColeta(`coleta-${indice}`, `2026-08-${String(31 - indice % 31).padStart(2, '0')}`, indice + 1)
    );
    const leitor = criarLeitor(coletas, []);

    const resumo = exigirDisponivel(await leitor.ler());

    expect(resumo).toMatchObject({ status: 'disponivel', coletasAnalisadas: 100, limiteColetas: 100, historicoTruncado: true });
    expect(leitor.repositorioColetas.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-a', pacienteId: 'paciente-a', excluidaEm: expect.anything() },
      take: 101,
      select: { id: true, coletadaEm: true, criadoEm: true },
      order: { coletadaEm: 'DESC', criadoEm: 'DESC', id: 'DESC' }
    }));
    const consultaMarcadores = (leitor.repositorioResultados.find as jest.Mock).mock.calls[0]?.[0] as {
      where: { tenantId: string; coletaId: unknown; excluidoEm: unknown };
      take: number;
      select: Record<string, boolean>;
    };
    expect(consultaMarcadores.where.tenantId).toBe('tenant-a');
    expect(consultaMarcadores.where.excluidoEm).toBeDefined();
    expect(consultaMarcadores.where.coletaId).toEqual(In(coletas.slice(0, 100).map(({ id }) => id)));
    expect(consultaMarcadores.take).toBe(10_001);
    expect(consultaMarcadores.select).toEqual({
      id: true, coletaId: true, catalogoMarcadorId: true, ordemExibicao: true, resultadoCriptografado: true
    });
  });

  it('mostra no máximo dez resultados e informa quantos foram omitidos', async () => {
    const coleta = [criarColeta('coleta-1', '2026-08-12')];
    const resultados = Array.from({ length: 11 }, (_, indice) => criarResultado(`resultado-${indice}`, 'coleta-1', {
      nome: `Marcador ${indice}`, valor: '101', unidade: 'mg/L', limiteInferior: '1', limiteSuperior: '100'
    }, { ordemExibicao: indice }));

    const resumo = exigirDisponivel(await criarLeitor(coleta, resultados).ler());

    expect(resumo).toMatchObject({ status: 'disponivel', gruposAnalisados: 11, totalForaFaixa: 11, itensLimitados: true });
    expect(resumo.itens).toHaveLength(10);
    expect(resumo.itens?.map((item) => item.resultadoId)).toEqual(resultados.slice(0, 10).map(({ id }) => id));
  });

  it('não consulta marcadores se não há coletas', async () => {
    const leitor = criarLeitor([], []);

    const resumo = exigirDisponivel(await leitor.ler());

    expect(resumo).toMatchObject({ status: 'disponivel', coletasAnalisadas: 0, historicoTruncado: false, totalForaFaixa: 0, itens: [] });
    expect(leitor.repositorioResultados.find).not.toHaveBeenCalled();
    expect(leitor.criptografia.descriptografar).not.toHaveBeenCalled();
  });

  it('informa indisponibilidade sem parcial se exceder o limite de marcadores', async () => {
    const resultados = Array.from({ length: 10_001 }, (_, indice) => criarResultado(
      `resultado-${indice}`, 'coleta-1', { nome: `Marcador ${indice}`, valor: '101', unidade: 'mg/L', limiteSuperior: '100' }
    ));
    const leitor = criarLeitor([criarColeta('coleta-1', '2026-08-12')], resultados);

    const resumo = await leitor.ler();

    expect(resumo).toEqual({ status: 'indisponivel' });
    expect(leitor.criptografia.descriptografar).not.toHaveBeenCalled();
  });

  it.each([
    ['falha de descriptografia', (buffer: Buffer) => { throw new Error(`Erro no payload ${buffer.length}.`); }],
    ['JSON inválido', (_buffer: Buffer) => '{json inválido'],
    ['estrutura inválida', (_buffer: Buffer) => JSON.stringify({ nome: '', valor: '5' })]
  ])('não retorna valores parciais diante de %s', async (_caso, decifrar) => {
    const leitor = criarLeitor([criarColeta('coleta-1', '2026-08-12')], [criarResultado(
      'resultado-1', 'coleta-1', { nome: 'Marcador sintético', valor: '101', unidade: 'mg/L', limiteSuperior: '100' }
    )]);
    leitor.criptografia.descriptografar.mockImplementation(decifrar as never);

    const resumo = await leitor.ler();

    expect(resumo).toEqual({ status: 'indisponivel' });
  });

  it('propaga falha da consulta sem converter falha da transação em ausência de exames', async () => {
    const falha = new Error('consulta indisponível');
    const leitor = criarLeitor([], []);
    leitor.repositorioColetas.find.mockRejectedValue(falha);

    await expect(leitor.ler()).rejects.toBe(falha);
    expect(leitor.criptografia.descriptografar).not.toHaveBeenCalled();
  });
});
