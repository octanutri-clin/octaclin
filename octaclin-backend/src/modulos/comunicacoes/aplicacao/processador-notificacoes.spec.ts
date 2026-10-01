import { ProcessadorNotificacoes } from './processador-notificacoes';
import { CanalNotificacaoOrm } from '../infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';
import { TemplateMensagemOrm } from '../infraestrutura/template-mensagem.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { OcorrenciaFollowupAgendaOrm } from '../../agenda/infraestrutura/ocorrencia-followup-agenda.orm';
import { PoliticaFollowupAgendaOrm } from '../../agenda/infraestrutura/politica-followup-agenda.orm';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import * as origemAcompanhamento from './validar-origem-lembrete-acompanhamento';

function criarProcessador(adaptadorEmail: { enviar: jest.Mock }, tipoCanal: string = 'email', aprovado = true) {
  const mensagem = {
    id: 'mensagem-1',
    tenantId: 'tenant-1',
    canalId: 'canal-1',
    templateId: 'template-1',
    status: 'pendente',
    pacienteId: undefined as string | undefined,
    chaveIdempotencia: undefined as string | undefined,
    conteudoCriptografado: undefined as Buffer | undefined,
    erro: undefined as string | undefined,
    payload: { destino: 'paciente@example.com' } as Record<string, unknown>
  };
  const canal = { id: 'canal-1', tenantId: 'tenant-1', tipo: tipoCanal, ativo: true };
  const template = { id: 'template-1', tenantId: 'tenant-1', canal: tipoCanal, aprovado,
    codigoExterno: 'octaclin_inicial_lembrete_tarefa' };
  const repositorioMensagens = {
    update: jest.fn(async () => ({ affected: 1 })),
    findOne: jest.fn(async () => mensagem),
    save: jest.fn(async (entrada: Record<string, unknown>) => entrada)
  };
  const repositorioCanais = {
    findOneByOrFail: jest.fn(async () => canal)
  };
  const repositorioTemplates = {
    findOneByOrFail: jest.fn(async () => template)
  };
  // Tenant sem usuario ativo: a falha de envio nao tem destinatario e o
  // publicador da Fase 210 sai antes de escrever. Quem cobre o fan-out em si e
  // registrar-notificacao.spec.ts.
  const repositorioUsuarios = { find: jest.fn(async () => []) };
  const consulta = { id: 'consulta-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', inicioEm: new Date(Date.now() + 86400000), status: 'agendada', followupPoliticaId: 'politica-1', notificacoes: {} };
  const ocorrencia = { id: 'ocorrencia-1', tenantId: 'tenant-1', consultaId: 'consulta-1', politicaId: 'politica-1', status: 'enfileirada', chaveIdempotencia: 'chave-1', politicaVersao: 1, condicao: 'somente_se_nao_confirmada' };
  const politica = { id: 'politica-1', tenantId: 'tenant-1', ativo: true, versao: 1 };
  const paciente = { id: 'paciente-1', tenantId: 'tenant-1', contatoCriptografado: Buffer.from(JSON.stringify({ email: 'paciente@example.com', preferencias: { email: true, whatsapp: false } })) };
  const repoConsulta = { findOne: jest.fn(async () => consulta) };
  const repoOcorrencia = { findOne: jest.fn(async () => ocorrencia), update: jest.fn(async () => undefined) };
  const repoPolitica = { findOne: jest.fn(async () => politica) };
  const repoPaciente = { findOne: jest.fn(async () => paciente) };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === MensagemNotificacaoOrm) return repositorioMensagens;
      if (entidade === CanalNotificacaoOrm) return repositorioCanais;
      if (entidade === TemplateMensagemOrm) return repositorioTemplates;
      if (entidade === UsuarioOrm) return repositorioUsuarios;
      if (entidade === AgendaConsultaOrm) return repoConsulta;
      if (entidade === OcorrenciaFollowupAgendaOrm) return repoOcorrencia;
      if (entidade === PoliticaFollowupAgendaOrm) return repoPolitica;
      if (entidade === PacienteOrm) return repoPaciente;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };
  const adaptadorPlaceholder = { enviar: jest.fn() };
  const criptografia = {
    criptografar: jest.fn((valor: string) => Buffer.from(valor, 'utf8')),
    descriptografar: jest.fn((valor: Buffer) => valor.toString('utf8'))
  };
  const processador = new ProcessadorNotificacoes(
    executorTenant as never,
    adaptadorPlaceholder as never,
    adaptadorEmail as never,
    adaptadorPlaceholder as never,
    criptografia as never
  );

  return { processador, mensagem, repositorioMensagens, adaptadorPlaceholder, consulta, ocorrencia, paciente, repoOcorrencia };
}

describe('ProcessadorNotificacoes', () => {
  afterEach(() => jest.restoreAllMocks());

  it('cancela lembrete de acompanhamento quando a origem mudou antes da entrega', async () => {
    jest.spyOn(origemAcompanhamento, 'validarOrigemLembreteAcompanhamento').mockResolvedValue(null);
    const email = { enviar: jest.fn() };
    const { processador, mensagem } = criarProcessador(email);
    mensagem.pacienteId = 'paciente-1';
    mensagem.chaveIdempotencia = 'tarefa-acompanhamento:tarefa-a:1:email';
    mensagem.payload = { evento: 'automacao.regra.template', destino: 'paciente@example.com' };
    mensagem.conteudoCriptografado = Buffer.from(JSON.stringify({ origemAcompanhamento: {
      tipo: 'tarefa', recursoId: 'tarefa-a', chaveIdempotencia: 'tarefa-acompanhamento:tarefa-a:1'
    } }));
    await processador.processarMensagem('tenant-1', mensagem.id);
    expect(email.enviar).not.toHaveBeenCalled();
    expect(mensagem.status).toBe('cancelado');
    expect(mensagem.erro).toBe('origem_indisponivel');
  });

  it('cancela lembrete cifrado ilegível sem chamar o provedor', async () => {
    const email = { enviar: jest.fn() };
    const { processador, mensagem } = criarProcessador(email);
    mensagem.pacienteId = 'paciente-1';
    mensagem.chaveIdempotencia = 'tarefa-acompanhamento:tarefa-a:1:email';
    mensagem.payload = { evento: 'automacao.regra.template', destino: 'paciente@example.com' };
    mensagem.conteudoCriptografado = Buffer.from('payload invalido');
    await processador.processarMensagem('tenant-1', mensagem.id);
    expect(email.enviar).not.toHaveBeenCalled();
    expect(mensagem.status).toBe('cancelado');
    expect(mensagem.erro).toBe('origem_invalida');
  });
  it('suprime follow-up depois de cancelamento antes de chamar o adaptador', async () => {
    const email = { enviar: jest.fn() };
    const { processador, mensagem, consulta, repoOcorrencia } = criarProcessador(email);
    consulta.status = 'cancelada';
    mensagem.pacienteId = 'paciente-1';
    mensagem.chaveIdempotencia = 'chave-1';
    mensagem.payload = { evento: 'agenda.consulta.followup', consultaId: 'consulta-1', consultaInicioEm: consulta.inicioEm.toISOString() };
    mensagem.conteudoCriptografado = Buffer.from(JSON.stringify({ followupOcorrenciaId: 'ocorrencia-1' }));
    await processador.processarMensagem('tenant-1', mensagem.id);
    expect(email.enviar).not.toHaveBeenCalled();
    expect(mensagem.status).toBe('cancelado');
    expect(repoOcorrencia.update).toHaveBeenCalledWith({ id: 'ocorrencia-1', tenantId: 'tenant-1' }, expect.objectContaining({ status: 'suprimida' }));
  });

  it('respeita opt-out alterado depois do enfileiramento', async () => {
    const email = { enviar: jest.fn() };
    const { processador, mensagem, consulta, paciente } = criarProcessador(email);
    mensagem.pacienteId = 'paciente-1';
    mensagem.chaveIdempotencia = 'chave-1';
    mensagem.payload = { evento: 'agenda.consulta.followup', consultaId: 'consulta-1', consultaInicioEm: consulta.inicioEm.toISOString(), destino: 'paciente@example.com' };
    mensagem.conteudoCriptografado = Buffer.from(JSON.stringify({ followupOcorrenciaId: 'ocorrencia-1' }));
    paciente.contatoCriptografado = Buffer.from(JSON.stringify({ email: 'paciente@example.com', preferencias: { email: false, whatsapp: false } }));
    await processador.processarMensagem('tenant-1', mensagem.id);
    expect(email.enviar).not.toHaveBeenCalled();
    expect(mensagem.status).toBe('cancelado');
    expect(mensagem.erro).toBe('preferencia_alterada');
  });
  it('nao envia mensagem de excecao removida com a mesma versao do padrao', async () => {
    const email = { enviar: jest.fn() };
    const { processador, mensagem, consulta, ocorrencia } = criarProcessador(email);
    mensagem.pacienteId = 'paciente-1';
    mensagem.chaveIdempotencia = 'chave-1';
    mensagem.payload = { evento: 'agenda.consulta.followup', consultaId: 'consulta-1', consultaInicioEm: consulta.inicioEm.toISOString() };
    mensagem.conteudoCriptografado = Buffer.from(JSON.stringify({ followupOcorrenciaId: 'ocorrencia-1' }));
    ocorrencia.politicaId = 'excecao-removida';
    await processador.processarMensagem('tenant-1', mensagem.id);
    expect(email.enviar).not.toHaveBeenCalled();
    expect(mensagem.status).toBe('cancelado');
    expect(mensagem.erro).toBe('politica_alterada');
  });
  it('deve persistir falha e nao propagar erro quando solicitado', async () => {
    const erro = new Error('SMTP indisponivel');
    const { processador, mensagem, repositorioMensagens } = criarProcessador({
      enviar: jest.fn(async () => {
        throw erro;
      })
    });

    await expect(
      processador.processarMensagem('tenant-1', 'mensagem-1', { propagarErro: false })
    ).resolves.toBeUndefined();

    expect(mensagem.status).toBe('falhou');
    expect(mensagem.erro).toBe('SMTP indisponivel');
    expect(repositorioMensagens.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'falhou' }));
  });

  it('deve persistir falha e propagar erro por padrao', async () => {
    const erro = new Error('SMTP indisponivel');
    const { processador, mensagem } = criarProcessador({
      enviar: jest.fn(async () => {
        throw erro;
      })
    });

    await expect(processador.processarMensagem('tenant-1', 'mensagem-1')).rejects.toThrow('SMTP indisponivel');

    expect(mensagem.status).toBe('falhou');
  });

  it('nao chama o adaptador quando outra instancia ja reivindicou a mensagem', async () => {
    const adaptadorEmail = { enviar: jest.fn(async () => ({ idExterno: 'email-1' })) };
    const { processador, repositorioMensagens } = criarProcessador(adaptadorEmail);
    repositorioMensagens.update.mockResolvedValue({ affected: 0 });

    await processador.processarMensagem('tenant-1', 'mensagem-1');

    expect(adaptadorEmail.enviar).not.toHaveBeenCalled();
  });

  it('nao envia WhatsApp pendente quando o template perdeu aprovacao apos enfileirar', async () => {
    const adaptador = { enviar: jest.fn(async () => ({ idExterno: 'wa-1' })) };
    const { processador, mensagem, adaptadorPlaceholder } = criarProcessador(adaptador, 'whatsapp', false);

    await expect(processador.processarMensagem('tenant-1', 'mensagem-1', { propagarErro: false })).resolves.toBeUndefined();

    expect(mensagem.status).toBe('falhou');
    expect(mensagem.erro).toContain('aprovado');
    expect(adaptadorPlaceholder.enviar).not.toHaveBeenCalled();
  });

  it('envia WhatsApp pendente quando o template continua aprovado', async () => {
    const adaptadorEmail = { enviar: jest.fn() };
    const { processador, mensagem, adaptadorPlaceholder } = criarProcessador(adaptadorEmail, 'whatsapp', true);
    adaptadorPlaceholder.enviar.mockResolvedValue({ idExterno: 'wa-1' });

    await expect(processador.processarMensagem('tenant-1', 'mensagem-1')).resolves.toBeUndefined();

    expect(mensagem.status).toBe('enviado');
    expect(adaptadorPlaceholder.enviar).toHaveBeenCalledTimes(1);
  });

  it('canal push registra falha explicita em vez de sucesso silencioso', async () => {
    const adaptadorEmail = { enviar: jest.fn(async () => ({ idExterno: 'email-1' })) };
    const { processador, mensagem, adaptadorPlaceholder } = criarProcessador(adaptadorEmail, 'push');

    await expect(
      processador.processarMensagem('tenant-1', 'mensagem-1', { propagarErro: false })
    ).resolves.toBeUndefined();

    expect(mensagem.status).toBe('falhou');
    expect(mensagem.erro).toBeTruthy();
    expect(adaptadorPlaceholder.enviar).not.toHaveBeenCalled();
  });

  it('canal com tipo desconhecido registra falha explicita em vez de sucesso silencioso', async () => {
    const adaptadorEmail = { enviar: jest.fn(async () => ({ idExterno: 'email-1' })) };
    const { processador, mensagem, adaptadorPlaceholder } = criarProcessador(adaptadorEmail, 'sms');

    await expect(
      processador.processarMensagem('tenant-1', 'mensagem-1', { propagarErro: false })
    ).resolves.toBeUndefined();

    expect(mensagem.status).toBe('falhou');
    expect(mensagem.erro).toBeTruthy();
    expect(adaptadorPlaceholder.enviar).not.toHaveBeenCalled();
  });
});
