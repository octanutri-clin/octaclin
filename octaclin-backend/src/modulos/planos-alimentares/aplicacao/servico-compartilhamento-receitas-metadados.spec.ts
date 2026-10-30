import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { UserActionLogOrm } from '../../../infraestrutura/auditoria/user-action-log.orm';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ReceitaNutricionalOrm } from '../infraestrutura/receita-nutricional.orm';
import { CompartilhamentoReceitaNutricionalOrm } from '../infraestrutura/compartilhamento-receita-nutricional.orm';
import { EntregaCompartilhamentoReceitaOrm } from '../infraestrutura/entrega-compartilhamento-receita.orm';
import { PreferenciaCompartilhamentoReceitaOrm } from '../infraestrutura/preferencia-compartilhamento-receita.orm';
import { ServicoReceitasNutricionais } from './servico-receitas-nutricionais';
import { ServicoPorcionamentoReceita } from './servico-porcionamento-receita';
import { ServicoCompartilhamentoReceitas } from './servico-compartilhamento-receitas';

const T = '10000000-0000-4000-8000-000000000001', U = '10000000-0000-4000-8000-000000000002', P = '10000000-0000-4000-8000-000000000003';
const R = '10000000-0000-4000-8000-000000000004', S = '10000000-0000-4000-8000-000000000005';
const pacienteUser: UsuarioAutenticado = { tenantId: T, usuarioId: U, papel: 'Patient', emailHash: 'sintetico', permissoes: [] };
const profissional: UsuarioAutenticado = { ...pacienteUser, papel: 'Professional', permissoes: ['planos_alimentares.gerenciar'] };
const conteudo = () => ({ instrucoes: 'Prepare.', itens: [{ descricao: 'Alimento sintético', quantidade: 1, unidade: 'g', porcaoGramas: 100,
  nutrientesPor100g: { energiaKcal: 100, proteinasG: 1, carboidratosG: 20, gordurasG: 1 }, substituicoes: [] }],
  metadados: { schemaVersao: 1, etiquetas: ['Interna'], baseQuantidades: 'receita_inteira', rendimentoPorcoes: 4, tempoPreparoMinutos: 20 } });

describe('FOOD07 — fronteira pública antes do writer de metadados', () => {
  let crypto: CriptografiaDadosSensiveis, servico: ServicoCompartilhamentoReceitas, share: CompartilhamentoReceitaNutricionalOrm;
  let saveShare: jest.Mock, auditoria: jest.Mock;
  beforeEach(() => {
    crypto = new CriptografiaDadosSensiveis();
    share = { id: S, tenantId: T, pacienteId: P, receitaId: R, status: 'ativo', visualizadoEm: new Date(),
      snapshotCriptografado: crypto.criptografar(JSON.stringify({ nome: 'Receita sintética', versao: 1, conteudo: conteudo(), contextoInterno: 'nao-publico' })) } as CompartilhamentoReceitaNutricionalOrm;
    saveShare = jest.fn(async x => x); auditoria = jest.fn(async x => x);
    const repos = new Map<Function, object>([
      [PacienteOrm, { findOne: jest.fn(async () => ({ id: P, tenantId: T, usuarioId: U, profissionalResponsavelId: U })) }],
      [ProfissionalOrm, { findOne: jest.fn(async () => ({ id: U, tenantId: T, usuarioId: U })) }],
      [PreferenciaCompartilhamentoReceitaOrm, { findOne: jest.fn(async () => null) }],
      [ReceitaNutricionalOrm, { find: jest.fn(async () => [{ id: R, tenantId: T, origem: 'clinica', categoria: 'Lanche', versaoAtual: 1,
        nomeCriptografado: crypto.criptografar('Receita sintética'), conteudoCriptografado: crypto.criptografar(JSON.stringify(conteudo())) }]) }],
      [CompartilhamentoReceitaNutricionalOrm, { find: jest.fn(async () => []), create: (x: object) => ({ ...x, id: S }), save: saveShare,
        update: jest.fn(async () => ({ affected: 0 })), findOne: jest.fn(async (o: { where: Partial<CompartilhamentoReceitaNutricionalOrm> }) =>
          Object.entries(o.where).every(([k, v]) => (share as unknown as Record<string, unknown>)[k] === v) ? share : null) }],
      [EntregaCompartilhamentoReceitaOrm, { create: (x: object) => x, save: jest.fn(async x => x) }],
      [UserActionLogOrm, { create: (x: object) => x, save: auditoria }]
    ]);
    const manager = { query: jest.fn(async () => []), getRepository: (entidade: Function) => {
      const repo = repos.get(entidade); if (!repo) throw new Error('Repositório não esperado no cenário'); return repo;
    } } as unknown as EntityManager;
    const executor = { executar: async (_t: string, fn: (g: EntityManager) => Promise<unknown>) => fn(manager) };
    servico = new ServicoCompartilhamentoReceitas(executor as unknown as ExecutorTenant, crypto, new ServicoPorcionamentoReceita(executor as unknown as ExecutorTenant, new ServicoReceitasNutricionais(executor as unknown as ExecutorTenant, crypto)));
  });
  it('não inclui tags/base/contexto interno na resposta ao paciente nem reescreve o snapshot', async () => {
    const antes = Buffer.from(share.snapshotCriptografado);
    const r = await servico.obterPortal(T, pacienteUser, S);
    expect(r.receita).toEqual({ nome: 'Receita sintética', versao: 1, conteudo: {
      instrucoes: 'Prepare.', itens: conteudo().itens, metadados: { schemaVersao: 1, rendimentoPorcoes: 4, tempoPreparoMinutos: 20 }
    } });
    expect(JSON.stringify(r)).not.toMatch(/Interna|etiquetas|baseQuantidades|nao-publico/);
    expect(share.snapshotCriptografado).toEqual(antes);
  });
  it('novos snapshots de compartilhamento legado já excluem as tags internas', async () => {
    await servico.compartilhar(T, profissional, { pacienteId: P, chaveIdempotencia: S, receitaIds: [R], versoesEsperadas: [{ receitaId: R, versao: 1 }], canais: ['portal'], confirmacaoRevisaoManual: true });
    const salvo = saveShare.mock.calls[0][0] as CompartilhamentoReceitaNutricionalOrm;
    const snapshot = JSON.parse(crypto.descriptografar(salvo.snapshotCriptografado));
    expect(snapshot.conteudo.metadados).toEqual({ schemaVersao: 1, rendimentoPorcoes: 4, tempoPreparoMinutos: 20 });
    expect(JSON.stringify(snapshot)).not.toMatch(/Interna|etiquetas|baseQuantidades/);
  });
  it('rejeita snapshot inválido antes da primeira leitura/auditoria sem expor conteúdo', async () => {
    share.visualizadoEm = null;
    share.snapshotCriptografado = crypto.criptografar('{"nome":"sintético","versao":1,"conteudo":{"itens":"inválido"}}');
    await expect(servico.obterPortal(T, pacienteUser, S)).rejects.toBeInstanceOf(BadRequestException);
    expect(saveShare).not.toHaveBeenCalled(); expect(auditoria).not.toHaveBeenCalled();
  });
  it('P2 preserva acesso ao snapshot legado com null opcional e não reescreve seus bytes', async () => {
    const item = { ...conteudo().itens[0], substituicoesVisiveisInicialmente: null,
      nutrientesPor100g: { ...conteudo().itens[0].nutrientesPor100g, fibrasG: null, sodioMg: null } };
    const antes = crypto.criptografar(JSON.stringify({ nome: 'Legado', versao: 1, conteudo: { itens: [item] } }));
    share.snapshotCriptografado = antes;
    const r = await servico.obterPortal(T, pacienteUser, S);
    expect(r.receita.conteudo.itens[0].nutrientesPor100g?.fibrasG).toBeUndefined();
    expect(r.receita.conteudo.itens[0]).not.toHaveProperty('substituicoesVisiveisInicialmente');
    expect(share.snapshotCriptografado).toEqual(antes);
  });
  it('conserva 404 indistinguível para snapshot fora do paciente ou não ativo', async () => {
    share.pacienteId = R;
    await expect(servico.obterPortal(T, pacienteUser, S)).rejects.toBeInstanceOf(NotFoundException);
    share.pacienteId = P; share.status = 'retirado';
    await expect(servico.obterPortal(T, pacienteUser, S)).rejects.toBeInstanceOf(NotFoundException);
    expect(saveShare).not.toHaveBeenCalled();
  });
});
