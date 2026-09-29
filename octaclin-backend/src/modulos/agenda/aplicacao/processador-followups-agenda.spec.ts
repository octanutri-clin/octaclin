import { AgendaConsultaOrm } from '../infraestrutura/agenda-consulta.orm';
import { OcorrenciaFollowupAgendaOrm } from '../infraestrutura/ocorrencia-followup-agenda.orm';
import { PoliticaFollowupAgendaOrm } from '../infraestrutura/politica-followup-agenda.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProcessadorFollowupsAgenda } from './processador-followups-agenda';

function cenario(confirmada = false) {
  const agora = new Date('2026-10-19T12:00:00Z');
  const inicio = new Date('2026-10-20T12:00:00Z');
  const item = { id: 'ocorrencia-1', tenantId: 'tenant-1', consultaId: 'consulta-1', politicaId: 'politica-1', inicioConsultaEm: inicio, envioEm: agora, disponivelEm: agora, status: 'pendente', condicao: 'somente_se_nao_confirmada', politicaVersao: 1, chaveIdempotencia: 'chave-1', tentativas: 0 };
  const consulta = { id: 'consulta-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', inicioEm: inicio, criadoEm: new Date('2026-10-01T12:00:00Z'), status: 'agendada', timezone: 'America/Sao_Paulo', modalidade: 'presencial', payload: { pacienteNome: 'Paciente sintetico' }, notificacoes: confirmada ? { confirmacaoPaciente: { status: 'confirmada' } } : {}, followupPoliticaId: 'politica-1' };
  const query = { where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), orderBy: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(), setLock: jest.fn().mockReturnThis(), setOnLocked: jest.fn().mockReturnThis(), getMany: jest.fn(async () => [item]) };
  const repoOcorrencia = { createQueryBuilder: jest.fn(() => query), findOne: jest.fn(async () => item), find: jest.fn(async () => []), update: jest.fn(async (_filtro: unknown, alteracoes: Record<string, unknown>) => { Object.assign(item, alteracoes); return { affected: 1 }; }) };
  const gerenciador = { getRepository: jest.fn((entidade: unknown) => {
    if (entidade === OcorrenciaFollowupAgendaOrm) return repoOcorrencia;
    if (entidade === AgendaConsultaOrm) return { findOne: jest.fn(async () => consulta) };
    if (entidade === PoliticaFollowupAgendaOrm) return { findOne: jest.fn(async () => ({ id: 'politica-1', ativo: true, versao: 1 })) };
    if (entidade === PacienteOrm) return { findOne: jest.fn(async () => ({ contatoCriptografado: Buffer.from(JSON.stringify({ email: 'teste@example.com', preferencias: { email: true, whatsapp: false } })) })) };
    throw new Error('Repositorio desconhecido');
  }) };
  const comunicacoes = { listarCanais: jest.fn(async () => [{ id: 'canal-email', tipo: 'email', ativo: true }]), listarTemplates: jest.fn(async () => [{ id: 'template-email', canal: 'email', conteudo: { evento: 'agenda.consulta.lembrete' } }]), dispararMensagemSistema: jest.fn(async () => ({ id: 'mensagem-1' })) };
  const executor = { executar: jest.fn(async (_tenant: string, operacao: (gerenciador: unknown) => Promise<unknown>) => operacao(gerenciador)) };
  const processador = new ProcessadorFollowupsAgenda({} as never, executor as never, {} as never, comunicacoes as never, { descriptografar: (valor: Buffer) => valor.toString() } as never);
  return { processador, agora, item, repoOcorrencia, comunicacoes };
}

describe('ProcessadorFollowupsAgenda', () => {
  it('enfileira uma unica mensagem com chave da etapa e tenant servidor', async () => {
    const { processador, agora, item, comunicacoes } = cenario();
    await processador.processarTenant('tenant-1', agora);
    expect(comunicacoes.dispararMensagemSistema).toHaveBeenCalledTimes(1);
    expect(comunicacoes.dispararMensagemSistema).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ chaveIdempotencia: 'chave-1', canalId: 'canal-email' }));
    expect(item.status).toBe('enfileirada');
  });

  it('suprime etapa condicional depois da confirmacao', async () => {
    const { processador, agora, item, comunicacoes } = cenario(true);
    await processador.processarTenant('tenant-1', agora);
    expect(item.status).toBe('suprimida');
    expect(comunicacoes.dispararMensagemSistema).not.toHaveBeenCalled();
  });

  it('suprime ocorrencia de outra politica mesmo quando ambas estao na versao 1', async () => {
    const { processador, agora, item, comunicacoes } = cenario();
    item.politicaId = 'excecao-removida';
    await processador.processarTenant('tenant-1', agora);
    expect(item.status).toBe('suprimida');
    expect(comunicacoes.dispararMensagemSistema).not.toHaveBeenCalled();
  });

  it('adia uma segunda etapa que caiu na mesma janela de envio', async () => {
    const { processador, agora, item, repoOcorrencia, comunicacoes } = cenario();
    repoOcorrencia.find.mockResolvedValueOnce([{ reivindicadoEm: agora } as never]);
    await processador.processarTenant('tenant-1', agora);
    expect(item.status).toBe('pendente');
    expect(item.disponivelEm.toISOString()).toBe('2026-10-19T12:30:00.000Z');
    expect(comunicacoes.dispararMensagemSistema).not.toHaveBeenCalled();
  });
});
