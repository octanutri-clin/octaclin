import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AgendaConsultaOrm } from '../infraestrutura/agenda-consulta.orm';
import { OcorrenciaFollowupAgendaOrm } from '../infraestrutura/ocorrencia-followup-agenda.orm';
import { PoliticaFollowupAgendaOrm } from '../infraestrutura/politica-followup-agenda.orm';
import { ServicoFollowupsAgenda } from './servico-followups-agenda';

const usuario: UsuarioAutenticado = { usuarioId: 'usuario-a', tenantId: 'tenant-a', papel: 'Professional', emailHash: 'hash', permissoes: [] };

function cenario({ consultaExiste = true, enviados = 0 }: { consultaExiste?: boolean; enviados?: number } = {}) {
  const consulta = { id: 'consulta-a', tenantId: 'tenant-a', profissionalId: 'profissional-a', inicioEm: new Date('2026-10-20T15:00:00Z'), timezone: 'America/Sao_Paulo', status: 'agendada', notificacoes: {} };
  const politica = { id: 'politica-a', tenantId: 'tenant-a', consultaId: null, versao: 1, ativo: true, etapas: [{ unidade: 'hora', valor: 24, condicao: 'sempre' }] };
  const ocorrencias = Array.from({ length: enviados }, (_, indice) => ({ id: `ocorrencia-${indice}`, mensagemId: `mensagem-${indice}`, status: 'enviada', inicioConsultaEm: consulta.inicioEm, envioEm: new Date(consulta.inicioEm.getTime() - 86400000), criadoEm: new Date() }));
  const insert = jest.fn().mockReturnThis();
  const values = jest.fn().mockReturnThis();
  const orIgnore = jest.fn().mockReturnThis();
  const execute = jest.fn().mockResolvedValue(undefined);
  const repoConsulta = { findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => consultaExiste && where.tenantId === 'tenant-a' && (!where.profissionalId || where.profissionalId === 'profissional-a') ? consulta : null), update: jest.fn(async () => undefined) };
  const repoPolitica = { findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => where.consultaId === 'consulta-a' ? null : politica) };
  const repoOcorrencia = { find: jest.fn(async () => ocorrencias), update: jest.fn(async () => undefined), createQueryBuilder: jest.fn(() => ({ insert, values, orIgnore, execute })) };
  const repoProfissional = { findOne: jest.fn(async () => ({ id: 'profissional-a' })) };
  const gerenciador = { getRepository: jest.fn((entidade: unknown) => {
    if (entidade === AgendaConsultaOrm) return repoConsulta;
    if (entidade === PoliticaFollowupAgendaOrm) return repoPolitica;
    if (entidade === OcorrenciaFollowupAgendaOrm) return repoOcorrencia;
    if (entidade === ProfissionalOrm) return repoProfissional;
    throw new Error('Repositorio desconhecido');
  }) };
  const servico = new ServicoFollowupsAgenda({ executar: jest.fn(async (_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => operacao(gerenciador)) } as never, { descriptografar: jest.fn() } as never);
  return { servico, gerenciador, consulta, repoConsulta, repoOcorrencia, repoPolitica, values };
}

describe('ServicoFollowupsAgenda', () => {
  it('nega consulta de outro profissional antes de consultar politica ou ocorrencias', async () => {
    const { servico, repoConsulta, repoPolitica, repoOcorrencia } = cenario({ consultaExiste: false });
    await expect(servico.obterConsulta('tenant-a', 'consulta-b', usuario)).rejects.toThrow('Consulta nao encontrada');
    expect(repoConsulta.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-a', profissionalId: 'profissional-a' }) }));
    expect(repoPolitica.findOne).not.toHaveBeenCalled();
    expect(repoOcorrencia.find).not.toHaveBeenCalled();
  });

  it('cria uma ocorrencia futura e usa chave estavel no tenant da consulta', async () => {
    const { servico, gerenciador, consulta, values } = cenario();
    await servico.reconciliarConsultaNaTransacao(gerenciador as never, 'tenant-a', consulta as never, new Date('2026-10-18T12:00:00Z'));
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a', consultaId: 'consulta-a', chaveIdempotencia: `agenda-followup:consulta-a:${consulta.inicioEm.getTime()}:${consulta.inicioEm.getTime() - 86400000}` }));
  });

  it('nao reinicia o teto de 30 envios apos remarcacao', async () => {
    const { servico, gerenciador, consulta, values } = cenario({ enviados: 30 });
    await servico.reconciliarConsultaNaTransacao(gerenciador as never, 'tenant-a', consulta as never, new Date('2026-10-18T12:00:00Z'));
    expect(values).not.toHaveBeenCalled();
  });
});
