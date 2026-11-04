import { EntityManager } from 'typeorm';
import { ServicoPorcionamentoReceita } from './servico-porcionamento-receita';
import { ServicoPlanosAlimentares } from './servico-planos-alimentares';
import { calcularNutrientesDaPorcao } from '../dominio/calculo-nutricional';
import { calcularTotaisPlano } from '../dominio/plano-alimentar';
import { ServicoReceitasNutricionais } from './servico-receitas-nutricionais';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';

const tenant = '10000000-0000-4000-8000-000000000001', receitaId = '10000000-0000-4000-8000-000000000002';
const alimentoId = '10000000-0000-4000-8000-000000000003', fonteId = '10000000-0000-4000-8000-000000000004';
const usuario = { tenantId: tenant, usuarioId: receitaId, papel: 'Professional', permissoes: ['planos_alimentares.ler'] } as UsuarioAutenticado;
const macros = { energiaKcal: 100, proteinasG: 10, carboidratosG: 20, gordurasG: 2 };
function receita(base = 'receita_inteira'): any {
  return { id: receitaId, nome: 'Receita sintética', versao: 3, conteudo: {
    instrucoes: 'Prepare 500 g.', itens: [{ descricao: 'Ingrediente sintético', quantidade: base === 'receita_inteira' ? 4 : 1, unidade: 'porção', porcaoGramas: base === 'receita_inteira' ? 500 : 125, nutrientesPor100g: { ...macros } }],
    metadados: { schemaVersao: 1, baseQuantidades: base, rendimentoPorcoes: 4, etiquetas: ['Privada'] }
  } };
}
describe('FOOD07 — prévia server-side', () => {
  let servico: ServicoPorcionamentoReceita, g: EntityManager, executar: jest.Mock, ler: jest.Mock, alimento: any, fonte: any;
  const salvar = jest.fn();
  beforeEach(() => {
    salvar.mockReset();
    ler = jest.fn(async () => receita());
    alimento = { id: alimentoId, fonteId, nome: 'Catálogo sintético', preparacao: 'cozido', baseGramas: '200.000', energiaKcal: '200', proteinasG: null, carboidratosG: '40', lipidiosG: '4', hashRegistro: 'a'.repeat(64) };
    fonte = { id: fonteId, codigo: 'SINTETICA', versao: '1', situacao: 'ativa', direitoUsoStatus: 'aprovado', hashConteudo: 'b'.repeat(64) };
    const qb: any = {};
    for (const metodo of ['innerJoinAndMapOne', 'select', 'where', 'orderBy']) qb[metodo] = jest.fn(() => qb);
    qb.getMany = jest.fn(async () => alimento && fonte ? [{ ...alimento, fonteResolvida: fonte }] : []);
    g = { getRepository: jest.fn((tipo: unknown) => ({ createQueryBuilder: jest.fn(() => qb),
      findOne: jest.fn(async (q: any) => tipo === AlimentoComposicaoOrm ? (q.where.id === alimento?.id ? alimento : null) : tipo === FonteComposicaoAlimentoOrm ? fonte : null), save: salvar
    })) } as unknown as EntityManager;
    executar = jest.fn(async (_t, f) => f(g));
    servico = new ServicoPorcionamentoReceita({ executar } as unknown as ExecutorTenant, { obterParaPorcionamento: ler } as unknown as ServicoReceitasNutricionais);
  });
  const prever = (porcoesDesejadas = 1.5, versaoEsperada = 3) => servico.prever(tenant, receitaId, usuario, { porcoesDesejadas, versaoEsperada });

  it.each([1, 1.5, 2.5])('duas bases resultam na mesma quantidade e total para %s porções', async porcoes => {
    const inteira = await prever(porcoes);
    ler.mockResolvedValue(receita('por_porcao'));
    const individual = await prever(porcoes);
    expect(inteira.estado).toBe('calculavel'); expect(individual.estado).toBe('calculavel');
    if (inteira.estado !== 'calculavel' || individual.estado !== 'calculavel') throw new Error('Prévia ausente');
    expect(inteira.itens).toEqual(individual.itens);
    expect(inteira.itens[0].porcaoGramas).toBe(125 * porcoes);
    expect(inteira.totais.energiaKcal).toEqual({ estado: 'conhecido', valor: 125 * porcoes, unidade: 'kcal' });
    expect(individual.totais).toEqual(inteira.totais);
    expect(inteira.denominador).toEqual({ porcoes: porcoes, descricao: 'Total para as porções solicitadas' });
    expect(JSON.stringify(inteira)).not.toMatch(/Privada|etiquetas|conteudoCriptografado/);
    expect(salvar).not.toHaveBeenCalled();
  });
  it.each([null, [], {}, { versaoEsperada: '3', porcoesDesejadas: 1 }, { versaoEsperada: 3, porcoesDesejadas: null },
    { versaoEsperada: 3, porcoesDesejadas: 0 }, { versaoEsperada: 3, porcoesDesejadas: 1.0001 },
    { versaoEsperada: 3, porcoesDesejadas: 1001 }, { versaoEsperada: 3, porcoesDesejadas: 1, tenantId: tenant },
    { versaoEsperada: 3, porcoesDesejadas: 1, itens: [] }, { versaoEsperada: 3, porcoesDesejadas: 1, fator: 10 },
    JSON.parse('{"versaoEsperada":3,"porcoesDesejadas":1,"__proto__":{}}')])('rejeita comando manipulado antes de abrir transação %#', async dados => {
    await expect(servico.prever(tenant, receitaId, usuario, dados)).rejects.toMatchObject({ status: 400 });
    expect(executar).not.toHaveBeenCalled();
  });
  it('rejeita versão stale sem fornecer prévia e reusa autorização efetiva', async () => {
    await expect(prever(1, 2)).rejects.toMatchObject({ status: 409 });
    expect(ler).toHaveBeenCalledWith(g, tenant, receitaId, usuario);
    ler.mockRejectedValue(Object.assign(new Error('Indisponível'), { status: 404 }));
    await expect(prever()).rejects.toMatchObject({ status: 404 });
  });
  it('permite composição parcial do catálogo sem inventar proteína e sem contar alternativas', async () => {
    const r = receita(); r.conteudo.itens = [{ alimentoComposicaoId: alimentoId, quantidade: 1, unidade: 'g', porcaoGramas: 500, nutrientesPor100g: { proteinasG: 999 }, substituicoes: [{ descricao: 'Não somar', quantidade: 1, unidade: 'g', porcaoGramas: 1, nutrientesPor100g: macros }] }] as any;
    ler.mockResolvedValue(r);
    const p = await prever(); if (p.estado !== 'calculavel') throw new Error('Prévia ausente');
    expect(p.totais.proteinasG).toEqual({ estado: 'ausente', unidade: 'g' });
    expect(p.totais.energiaKcal).toEqual({ estado: 'conhecido', valor: 187.5, unidade: 'kcal' });
    expect(p.itens[0].nutrientesPor100g).not.toHaveProperty('proteinasG');
    expect(p.itens[0].descricao).toBe('Catálogo sintético');
    expect(p.fontes[0]).toMatchObject({ alimentoComposicaoId: alimentoId, preparacao: 'cozido', fonte: { codigo: 'SINTETICA', versao: '1' } });
  });
  it('ausência em uma linha torna somente aquele total desconhecido; zero confiável continua zero', async () => {
    const r = receita(); r.conteudo.itens.push({ alimentoComposicaoId: alimentoId, quantidade: 1, unidade: 'g', porcaoGramas: 100 } as any);
    alimento.energiaKcal = '0'; ler.mockResolvedValue(r);
    const p = await prever(); if (p.estado !== 'calculavel') throw new Error('Prévia ausente');
    expect(p.totais.energiaKcal.valor).toBe(187.5); expect(p.totais.proteinasG.estado).toBe('ausente');
  });
  it.each(['inativa', 'direito', 'ausente', 'base', 'nutriente'])('fonte/composição %s impede a prévia inteira', async estado => {
    const r = receita(); r.conteudo.itens[0].alimentoComposicaoId = alimentoId; ler.mockResolvedValue(r);
    if (estado === 'inativa') fonte.situacao = 'inativa';
    if (estado === 'direito') fonte.direitoUsoStatus = 'pendente';
    if (estado === 'ausente') alimento = null;
    if (estado === 'base') alimento.baseGramas = '0';
    if (estado === 'nutriente') alimento.energiaKcal = '-1';
    await expect(prever()).rejects.toMatchObject({ status: 409 }); expect(salvar).not.toHaveBeenCalled();
  });
  it('fingerprint usa fatos canônicos e muda ao alterar fonte, composição, porção ou versão', async () => {
    const r = receita(); r.conteudo.itens[0].alimentoComposicaoId = alimentoId; ler.mockResolvedValue(r);
    const a = await prever();
    alimento = Object.fromEntries(Object.entries(alimento).reverse());
    expect((await prever()).fingerprint).toBe(a.fingerprint);
    alimento.energiaKcal = '201'; expect((await prever()).fingerprint).not.toBe(a.fingerprint);
    alimento.energiaKcal = '200'; fonte.versao = '2'; expect((await prever()).fingerprint).not.toBe(a.fingerprint);
    fonte.versao = '1'; expect((await prever(2.5)).fingerprint).not.toBe(a.fingerprint);
    r.versao = 4; expect((await prever(1.5, 4)).fingerprint).not.toBe(a.fingerprint);
  });
  it('legado sem base não é inferido e indisponibilidade não expõe resultado parcial', async () => {
    const r = receita(); delete (r.conteudo as any).metadados; ler.mockResolvedValue(r);
    const p = await prever(); expect(p.estado).toBe('indisponivel'); expect(p).not.toHaveProperty('itens');
    expect(p).toMatchObject({ motivos: [{ codigo: 'BASE_NAO_INFORMADA' }] });
  });
  it('não conserva micronutriente de catálogo enviado no cadastro como se fosse fonte autorizada', async () => {
    const r = receita(); r.conteudo.itens[0].alimentoComposicaoId = alimentoId;
    r.conteudo.itens[0].micronutrientesPor100g = { calcioMg: 999 };
    ler.mockResolvedValue(r);
    const p = await prever(); if (p.estado !== 'calculavel') throw new Error('Prévia ausente');
    expect(p.itens[0]).not.toHaveProperty('micronutrientesPor100g');
  });
  it('usa pesos efetivamente arredondados e nunca uma prévia anterior como origem', async () => {
    const r = receita(); r.conteudo.itens[0].porcaoGramas = 1; r.conteudo.metadados.rendimentoPorcoes = 3;
    ler.mockResolvedValue(r);
    const p = await prever(1); if (p.estado !== 'calculavel') throw new Error('Prévia ausente');
    expect(p.itens[0].porcaoGramas).toBe(0.333);
    expect(p.totais.energiaKcal.valor).toBe(0.333);
    p.itens[0].porcaoGramas = 999;
    const novamente = await prever(1); if (novamente.estado !== 'calculavel') throw new Error('Prévia ausente');
    expect(novamente.itens[0].porcaoGramas).toBe(0.333);
    expect(r.conteudo.itens[0].porcaoGramas).toBe(1);
  });
  it('compara diretamente prévia com o motor efetivo de materialização do plano', async () => {
    alimento.baseGramas = '100';
    for (const c of ['energiaKcal', 'proteinasG', 'carboidratosG', 'lipidiosG']) alimento[c] = '0.12345001';
    const r = receita('por_porcao'); r.conteudo.itens = Array.from({ length: 100 }, () => ({ alimentoComposicaoId: alimentoId, quantidade: 1, unidade: 'porção', porcaoGramas: 10000 }));
    ler.mockResolvedValue(r);
    const plano = Object.create(ServicoPlanosAlimentares.prototype) as any;
    const n = plano.obterNutrientesCatalogo(alimento, true);
    const esperados = calcularTotaisPlano({ refeicoes: [{ nome: 'Controle', itens: r.conteudo.itens.map((item: any) => ({ ...item, descricao: alimento.nome, substituicoes: [], nutrientes: calcularNutrientesDaPorcao(n, item.porcaoGramas) })) }] });
    const p = await prever(1); if (p.estado !== 'calculavel') throw new Error('Prévia ausente');
    expect(p.totais.energiaKcal.valor).toBe(esperados.energiaKcal);
    expect(p.itens[0].nutrientesPor100g).toEqual(n);
    expect(alimento.energiaKcal).toBe('0.12345001');
  });
  it('usa o EntityManager do compartilhamento sem iniciar transação aninhada', async () => {
    const p = await servico.preverNaTransacao(g, tenant, receitaId, usuario, { versaoEsperada: 3, porcoesDesejadas: 1 });
    expect(p.estado).toBe('calculavel'); expect(executar).not.toHaveBeenCalled();
  });
});
