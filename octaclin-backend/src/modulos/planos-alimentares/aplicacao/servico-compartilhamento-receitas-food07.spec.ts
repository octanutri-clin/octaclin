import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { ReceitaNutricionalOrm } from '../infraestrutura/receita-nutricional.orm';
import { CompartilhamentoReceitaNutricionalOrm } from '../infraestrutura/compartilhamento-receita-nutricional.orm';
import { EntregaCompartilhamentoReceitaOrm } from '../infraestrutura/entrega-compartilhamento-receita.orm';
import { PreferenciaCompartilhamentoReceitaOrm } from '../infraestrutura/preferencia-compartilhamento-receita.orm';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { ServicoCompartilhamentoReceitas } from './servico-compartilhamento-receitas';
import { ServicoReceitasNutricionais } from './servico-receitas-nutricionais';
import { ServicoPorcionamentoReceita } from './servico-porcionamento-receita';

const T = '10000000-0000-4000-8000-000000000001', U = '10000000-0000-4000-8000-000000000002', P = '10000000-0000-4000-8000-000000000003';
const R = '10000000-0000-4000-8000-000000000004', D = '10000000-0000-4000-8000-000000000005';
const usuario: UsuarioAutenticado = { tenantId: T, usuarioId: U, papel: 'Professional', emailHash: 'sintetico', permissoes: ['planos_alimentares.ler', 'planos_alimentares.gerenciar'] };
function corresponde(row: any, where: any): boolean {
  return (Array.isArray(where) ? where : [where]).some(w => Object.entries(w ?? {}).every(([k, v]: [string, any]) => {
    if (v && typeof v === 'object' && '_type' in v) {
      if (v._type === 'isNull') return row[k] == null;
      if (v._type === 'in') return v._value.includes(row[k]);
      if (v._type === 'like') return row[k]?.startsWith(v._value.replace(/%$/, ''));
    }
    return row[k] === v;
  }));
}
interface Repo { rows: any[]; findOne: jest.Mock; find: jest.Mock; create: (x: object) => any; save: jest.Mock; update: jest.Mock }
function repositorio(rows: any[] = []): Repo {
  const repo: Repo = { rows, findOne: jest.fn(async (o: any) => repo.rows.find(r => corresponde(r, o.where)) ?? null),
    find: jest.fn(async (o: any = {}) => repo.rows.filter(r => corresponde(r, o.where))),
    create: (x: object) => ({ id: randomUUID(), ...x }),
    save: jest.fn(async (x: any): Promise<any> => {
      if (Array.isArray(x)) return Promise.all(x.map(repo.save));
      const antigo = repo.rows.find(r => r.id === x.id);
      if (antigo) Object.assign(antigo, x); else repo.rows.push(x);
      return x;
    }),
    update: jest.fn(async (where: any, patch: any) => { const rs = repo.rows.filter(r => corresponde(r, where)); rs.forEach(r => Object.assign(r, patch)); return { affected: rs.length }; })
  }; return repo;
}

function fixture() {
  const crypto = new CriptografiaDadosSensiveis();
  const conteudo = { instrucoes: 'Prepare 100 g.\r\nSirva.', itens: [{ descricao: 'Controle sintético', quantidade: 4, unidade: 'colher', porcaoGramas: 100,
    nutrientesPor100g: { energiaKcal: 100, proteinasG: 10, carboidratosG: 20, gordurasG: 2 }, substituicoes: [] }],
    metadados: { schemaVersao: 1, etiquetas: ['Uso interno'], baseQuantidades: 'receita_inteira', rendimentoPorcoes: 4, tempoPreparoMinutos: 20 } };
  const receita = { id: R, tenantId: T, origem: 'clinica', tipo: 'receita', categoria: 'Lanche', versaoAtual: 1, etiquetasHashes: [crypto.gerarHashPerfilExato(T, 'tag', 'Uso interno')],
    nomeCriptografado: crypto.criptografar('Receita sintética'), conteudoCriptografado: crypto.criptografar(JSON.stringify(conteudo)) };
  const repos = new Map<Function, ReturnType<typeof repositorio>>([
    [PacienteOrm, repositorio([{ id: P, tenantId: T, usuarioId: D, profissionalResponsavelId: U }])],
    [ProfissionalOrm, repositorio([{ id: U, usuarioId: U, tenantId: T }])],
    [ReceitaNutricionalOrm, repositorio([receita])], [CompartilhamentoReceitaNutricionalOrm, repositorio()],
    [EntregaCompartilhamentoReceitaOrm, repositorio()], [PreferenciaCompartilhamentoReceitaOrm, repositorio()],
    [UserActionLogOrm, repositorio()], [AlimentoComposicaoOrm, repositorio()], [FonteComposicaoAlimentoOrm, repositorio()]
  ]);
  const query = jest.fn(async () => []);
  const g = { query, getRepository: (c: Function) => { const r = repos.get(c); if (!r) throw new Error('Repo não previsto'); return r; } } as unknown as EntityManager;
  const executor = { executar: async (_t: string, f: (m: EntityManager) => Promise<any>) => {
    const backup = new Map([...repos].map(([c, r]) => [c, r.rows.map(x => ({ referencia: x, dados: { ...x } }))]));
    try { return await f(g); } catch (e) { for (const [c, rows] of backup) repos.get(c)!.rows = rows.map(x => { for (const k of Object.keys(x.referencia)) delete x.referencia[k]; return Object.assign(x.referencia, x.dados); }); throw e; }
  } } as unknown as ExecutorTenant;
  const receitas = new ServicoReceitasNutricionais(executor, crypto), previa = new ServicoPorcionamentoReceita(executor, receitas);
  const service = Reflect.construct(ServicoCompartilhamentoReceitas, [executor, crypto, previa]) as ServicoCompartilhamentoReceitas;
  const base = (chaveIdempotencia = randomUUID()) => ({ pacienteId: P, receitaIds: [R], versoesEsperadas: [{ receitaId: R, versao: 1 }], canais: ['portal'], chaveIdempotencia, confirmacaoRevisaoManual: true });
  const pedido = async (porcoesDesejadas = 1.5, instrucoesPersonalizadas?: string, chaveIdempotencia = randomUUID()) => {
    const p = await previa.prever(T, R, usuario, { versaoEsperada: 1, porcoesDesejadas });
    return { ...base(chaveIdempotencia), porcionamentos: [{ receitaId: R, porcoesDesejadas, fingerprintPrevia: p.fingerprint, confirmacaoConferenciaInstrucoes: true,
      ...(instrucoesPersonalizadas === undefined ? {} : { instrucoesPersonalizadas }) }] };
  };
  const snapshot = (i = 0) => JSON.parse(crypto.descriptografar(repos.get(CompartilhamentoReceitaNutricionalOrm)!.rows[i].snapshotCriptografado));
  return { crypto, conteudo, receita, repos, service, previa, pedido, base, snapshot, query };
}

describe('FOOD07 — envio personalizado e identidade semântica', () => {
  it('congela 1,5 porções e instruções da cópia sem modificar a biblioteca', async () => {
    const f = fixture(), antes = Buffer.from(f.receita.conteudoCriptografado);
    const dados = await f.pedido(1.5, 'Prepare 37,5 g.\r\nSirva.');
    await f.service.compartilhar(T, usuario, dados as never);
    const s = f.snapshot();
    expect(s.conteudo.itens[0].porcaoGramas).toBe(37.5);
    expect(s.conteudo.itens[0].quantidade).toBe(1.5);
    expect(s.conteudo.instrucoes).toBe('Prepare 37,5 g.\nSirva.');
    expect(f.receita.conteudoCriptografado).toEqual(antes);
  });
  it('mesma chave com porção diferente conflita e preserva bytes/entregas', async () => {
    const f = fixture(), a = await f.pedido(1.5);
    await f.service.compartilhar(T, usuario, a as never);
    const antes = Buffer.from(f.repos.get(CompartilhamentoReceitaNutricionalOrm)!.rows[0].snapshotCriptografado);
    await expect(f.service.compartilhar(T, usuario, await f.pedido(2.5, undefined, a.chaveIdempotencia) as never)).rejects.toMatchObject({ status: 409 });
    expect(f.repos.get(CompartilhamentoReceitaNutricionalOrm)!.rows[0].snapshotCriptografado).toEqual(antes);
    expect(f.repos.get(EntregaCompartilhamentoReceitaOrm)!.rows).toHaveLength(1);
  });
  it('recusa instrução null sem gravar nada', async () => {
    const f = fixture(), p = await f.pedido(); (p.porcionamentos[0] as any).instrucoesPersonalizadas = null;
    await expect(f.service.compartilhar(T, usuario, p as never)).rejects.toMatchObject({ status: 400 });
    expect(f.repos.get(CompartilhamentoReceitaNutricionalOrm)!.rows).toHaveLength(0);
  });
  it.each([1, 1.5, 2.5])('congela %s porções sem segunda escala', async n => {
    const f = fixture(); await f.service.compartilhar(T, usuario, await f.pedido(n) as never);
    expect(f.snapshot().conteudo.itens[0].porcaoGramas).toBe(25 * n);
  });
  it.each(['', 'Preparação específica.', '🍋'.repeat(4000), 'Cafe\u0301.\r\nNão alterar 100 g automaticamente.'])('preserva intenção de texto, incluindo vazio e limite, sem reescrita numérica %#', async texto => {
    const f = fixture(); await f.service.compartilhar(T, usuario, await f.pedido(1.5, texto) as never);
    expect(f.snapshot().conteudo.instrucoes).toBe(texto.replace(/\r\n/g, '\n').normalize('NFC'));
  });
  it.each(['null', 'false', 'ausente', 'texto', 'extra', 'duplicado', 'fora', 'array', 'raiz', 'versoes', 'canais', 'quantidade'])('rejeita contrato inválido: %s', async tipo => {
    const f = fixture(), d: any = await f.pedido();
    if (tipo === 'null') d.porcionamentos = null;
    if (tipo === 'false') d.porcionamentos[0].confirmacaoConferenciaInstrucoes = false;
    if (tipo === 'ausente') delete d.porcionamentos[0].confirmacaoConferenciaInstrucoes;
    if (tipo === 'texto') d.porcionamentos[0].instrucoesPersonalizadas = 'x'.repeat(4001);
    if (tipo === 'extra') d.porcionamentos[0].contextoCompartilhamento = { pacienteId: P };
    if (tipo === 'duplicado') d.porcionamentos.push({ ...d.porcionamentos[0] });
    if (tipo === 'fora') d.porcionamentos[0].receitaId = D;
    if (tipo === 'array') d.porcionamentos = Array(11).fill(d.porcionamentos[0]);
    if (tipo === 'raiz') d.tenantId = T;
    if (tipo === 'versoes') d.versoesEsperadas = [];
    if (tipo === 'canais') d.canais.push('portal');
    if (tipo === 'quantidade') d.porcionamentos[0].porcoesDesejadas = 1.0001;
    await expect(f.service.compartilhar(T, usuario, d)).rejects.toMatchObject({ status: 400 });
    expect(f.repos.get(CompartilhamentoReceitaNutricionalOrm)!.rows).toHaveLength(0);
  });
  it('mesma chave com texto diferente conflita; NFC/CRLF equivalentes não conflitam', async () => {
    const f = fixture(), d = await f.pedido(1.5, 'Cafe\u0301.\r\nSirva.');
    await f.service.compartilhar(T, usuario, d as never);
    d.porcionamentos[0].instrucoesPersonalizadas = 'Café.\nSirva.';
    await expect(f.service.compartilhar(T, usuario, d as never)).resolves.toMatchObject({ quantidade: 1 });
    d.porcionamentos[0].instrucoesPersonalizadas = 'Outro preparo.';
    await expect(f.service.compartilhar(T, usuario, d as never)).rejects.toMatchObject({ status: 409 });
  });
  it('retry usa original congelado após editar biblioteca, inclusive omissão versus texto explícito igual', async () => {
    const f = fixture(), d = await f.pedido(), primeiro = await f.service.compartilhar(T, usuario, d as never);
    const bytes = Buffer.from(f.repos.get(CompartilhamentoReceitaNutricionalOrm)!.rows[0].snapshotCriptografado);
    f.receita.versaoAtual = 2; f.receita.conteudoCriptografado = f.crypto.criptografar(JSON.stringify({ ...f.conteudo, instrucoes: 'Texto novo.' }));
    expect(await f.service.compartilhar(T, usuario, d as never)).toEqual(primeiro);
    d.porcionamentos[0].instrucoesPersonalizadas = 'Prepare 100 g.\nSirva.';
    expect(await f.service.compartilhar(T, usuario, d as never)).toEqual(primeiro);
    expect(f.repos.get(CompartilhamentoReceitaNutricionalOrm)!.rows[0].snapshotCriptografado).toEqual(bytes);
    expect(f.repos.get(EntregaCompartilhamentoReceitaOrm)!.rows).toHaveLength(1);
  });
  it('novas confirmações rejeitam versão/fingerprint stale, sem writes', async () => {
    const f = fixture(), d = await f.pedido(); d.porcionamentos[0].fingerprintPrevia = 'f'.repeat(64);
    await expect(f.service.compartilhar(T, usuario, d as never)).rejects.toMatchObject({ status: 409 });
    const antigo = await f.pedido(); f.receita.versaoAtual = 2;
    await expect(f.service.compartilhar(T, usuario, antigo as never)).rejects.toMatchObject({ status: 409 });
    expect(f.repos.get(CompartilhamentoReceitaNutricionalOrm)!.rows).toHaveLength(0);
  });
  it('retry revalida carteira e origem pessoal, sem usar hash como autorização', async () => {
    const f = fixture(), d = await f.pedido(); await f.service.compartilhar(T, usuario, d as never);
    f.repos.get(PacienteOrm)!.rows[0].profissionalResponsavelId = D;
    await expect(f.service.compartilhar(T, usuario, d as never)).rejects.toMatchObject({ status: 404 });
    f.repos.get(PacienteOrm)!.rows[0].profissionalResponsavelId = U;
    Object.assign(f.receita, { origem: 'pessoal', profissionalId: D });
    await expect(f.service.compartilhar(T, usuario, d as never)).rejects.toMatchObject({ status: 404 });
    await expect(f.service.compartilhar(D, { ...usuario, tenantId: D }, d as never)).rejects.toMatchObject({ status: 404 });
  });
  it('trocar todos os IDs com a mesma chave não cria um novo lote', async () => {
    const f = fixture(), d = await f.pedido(); await f.service.compartilhar(T, usuario, d as never);
    f.repos.get(ReceitaNutricionalOrm)!.rows.push({ ...f.receita, id: D });
    const outro = { ...f.base(d.chaveIdempotencia), receitaIds: [D], versoesEsperadas: [{ receitaId: D, versao: 1 }] };
    await expect(f.service.compartilhar(T, usuario, outro as never)).rejects.toMatchObject({ status: 409 });
    expect(f.repos.get(CompartilhamentoReceitaNutricionalOrm)!.rows).toHaveLength(1);
  });
  it('snapshot legado sem hash permite somente replay antigo, nunca upgrade porcionado', async () => {
    const f = fixture(), d = f.base(), r = await f.service.compartilhar(T, usuario, d as never);
    const row = f.repos.get(CompartilhamentoReceitaNutricionalOrm)!.rows[0], s = f.snapshot(); delete s.contextoCompartilhamento;
    row.snapshotCriptografado = f.crypto.criptografar(JSON.stringify(s)); const bytes = Buffer.from(row.snapshotCriptografado);
    expect(await f.service.compartilhar(T, usuario, d as never)).toEqual(r);
    await expect(f.service.compartilhar(T, usuario, await f.pedido(4, undefined, d.chaveIdempotencia) as never)).rejects.toMatchObject({ status: 409 });
    expect(f.repos.get(CompartilhamentoReceitaNutricionalOrm)!.rows[0].snapshotCriptografado).toEqual(bytes);
  });
  it('agendamento congela conteúdo na confirmação e retry posterior não exige data futura novamente', async () => {
    const f = fixture(); await f.service.compartilhar(T, usuario, f.base() as never);
    const d = { ...await f.pedido(), agendadoPara: new Date(Date.now() + 86400000).toISOString() };
    const r = await f.service.compartilhar(T, usuario, d as never);
    expect(f.repos.get(CompartilhamentoReceitaNutricionalOrm)!.rows.map(x => x.status)).toEqual(['ativo', 'agendado']);
    const agora = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 172800000);
    try { expect(await f.service.compartilhar(T, usuario, d as never)).toEqual(r); } finally { agora.mockRestore(); }
    expect(f.snapshot(1).conteudo.itens[0].porcaoGramas).toBe(37.5);
  });
  it('portal mostra porções públicas e nenhum contexto/hash/fato original', async () => {
    const f = fixture(), r = await f.service.compartilhar(T, usuario, await f.pedido() as never);
    const p = await f.service.obterPortal(T, { ...usuario, usuarioId: D, papel: 'Patient' }, r.itens[0].id);
    expect(p.receita).toMatchObject({ porcionamento: { porcoesDesejadas: 1.5, rendimentoOriginalPorcoes: 4, ingredientesAjustados: true } });
    expect(JSON.stringify(p)).not.toMatch(/contextoCompartilhamento|hashPedido|fingerprint|originais|Uso interno|fontes/);
  });

});

describe('FOOD07 — snapshots e limites da fronteira', () => {
  it.each(['fator', 'quantidade', 'algoritmo', 'texto', 'hash', 'extra', 'original', 'fonte'])('snapshot interno inválido falha fechado: %s', async tipo => {
    const f = fixture(), r = await f.service.compartilhar(T, usuario, await f.pedido() as never), s = f.snapshot();
    if (tipo === 'fator') s.contextoCompartilhamento.porcionamento.fatorExato.denominador = '0';
    if (tipo === 'quantidade') s.conteudo.itens[0].porcaoGramas = 999;
    if (tipo === 'algoritmo') s.contextoCompartilhamento.porcionamento.algoritmo = 'desconhecido';
    if (tipo === 'texto') s.contextoCompartilhamento.instrucaoOriginal = null;
    if (tipo === 'hash') s.contextoCompartilhamento.hashPedidoCompartilhamento = 'nao-hash';
    if (tipo === 'extra') s.contextoCompartilhamento.pacienteId = P;
    if (tipo === 'original') s.contextoCompartilhamento.porcionamento.originais = [];
    if (tipo === 'fonte') s.contextoCompartilhamento.porcionamento.fontes = [null];
    const row = f.repos.get(CompartilhamentoReceitaNutricionalOrm)!.rows[0]; row.snapshotCriptografado = f.crypto.criptografar(JSON.stringify(s));
    f.repos.get(CompartilhamentoReceitaNutricionalOrm)!.save.mockClear();
    await expect(f.service.obterPortal(T, { ...usuario, usuarioId: D, papel: 'Patient' }, r.itens[0].id)).rejects.toMatchObject({ status: 400 });
    expect(f.repos.get(CompartilhamentoReceitaNutricionalOrm)!.save).not.toHaveBeenCalled();
  });
  it.each(['listarPortal', 'listarEnviosProfissional'])('leitor %s valida contexto, não apenas o nome', async metodo => {
    const f = fixture(); await f.service.compartilhar(T, usuario, await f.pedido() as never);
    const s = f.snapshot(); s.contextoCompartilhamento.schemaVersao = 999;
    f.repos.get(CompartilhamentoReceitaNutricionalOrm)!.rows[0].snapshotCriptografado = f.crypto.criptografar(JSON.stringify(s));
    const p = metodo === 'listarPortal' ? f.service.listarPortal(T, { ...usuario, usuarioId: D, papel: 'Patient' }) : f.service.listarEnviosProfissional(T, usuario, P);
    await expect(p).rejects.toMatchObject({ status: 400 });
  });
  it('rejeita getters e chaves especiais sem executar código de entrada', async () => {
    const f = fixture(), d: any = f.base(), getter = jest.fn(() => []);
    Object.defineProperty(d, 'porcionamentos', { enumerable: true, get: getter });
    await expect(f.service.compartilhar(T, usuario, d)).rejects.toMatchObject({ status: 400 });
    expect(getter).not.toHaveBeenCalled();
    for (const k of ['__proto__', 'constructor', 'prototype']) {
      const r = { ...f.base(), ...JSON.parse(`{"${k}":{}}`) };
      await expect(f.service.compartilhar(T, usuario, r as never)).rejects.toMatchObject({ status: 400 });
    }
  });
  it('lote misto preserva conteúdo legado e ordenação não altera identidade', async () => {
    const f = fixture(); f.repos.get(ReceitaNutricionalOrm)!.rows.push({ ...f.receita, id: D });
    const d = await f.pedido(); d.receitaIds.push(D); d.versoesEsperadas.push({ receitaId: D, versao: 1 });
    const r = await f.service.compartilhar(T, usuario, d as never);
    const rows = f.repos.get(CompartilhamentoReceitaNutricionalOrm)!.rows;
    const escalada = JSON.parse(f.crypto.descriptografar(rows.find(x => x.receitaId === R).snapshotCriptografado));
    const cadastrada = JSON.parse(f.crypto.descriptografar(rows.find(x => x.receitaId === D).snapshotCriptografado));
    expect(escalada.conteudo.itens[0].porcaoGramas).toBe(37.5);
    expect(cadastrada.conteudo.itens[0].porcaoGramas).toBe(100);
    expect(cadastrada.contextoCompartilhamento).not.toHaveProperty('porcionamento');
    d.receitaIds.reverse(); d.versoesEsperadas.reverse();
    expect(await f.service.compartilhar(T, usuario, d as never)).toEqual(r);
  });
  it('retirada e retry não reativam uma cópia anterior', async () => {
    const f = fixture(), d = await f.pedido(), r = await f.service.compartilhar(T, usuario, d as never);
    await f.service.retirar(T, usuario, r.itens[0].id);
    const replay = await f.service.compartilhar(T, usuario, d as never);
    expect(replay.itens[0].status).toBe('retirado');
    expect(f.repos.get(EntregaCompartilhamentoReceitaOrm)!.rows).toHaveLength(1);
  });
});
