import { EntityManager } from 'typeorm';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { OutboxEventoOrm } from '../../../infraestrutura/outbox/outbox-evento.orm';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';
import { registrarAvisoPlanoPublicado } from './registrar-aviso-plano-publicado';

function criarGerenciador(existente = false) {
  const mensagens: Array<Record<string, unknown>> = [];
  const eventos: Array<Record<string, unknown>> = [];
  const repoMensagem = {
    findOne: jest.fn(async () => existente ? { id: 'aviso-existente' } : null),
    create: jest.fn((entrada) => entrada),
    save: jest.fn(async (entrada) => {
      mensagens.push(entrada);
      return { id: 'aviso-portal-1', ...entrada };
    })
  };
  const repoOutbox = {
    create: jest.fn((entrada) => entrada),
    save: jest.fn(async (entrada) => {
      eventos.push(entrada);
      return entrada;
    })
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === MensagemNotificacaoOrm) return repoMensagem;
      if (entidade === OutboxEventoOrm) return repoOutbox;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  } as unknown as EntityManager;
  const criptografia = {
    criptografar: jest.fn((valor: string) => Buffer.from(valor, 'utf8'))
  } as unknown as CriptografiaDadosSensiveis;
  return { gerenciador, repoMensagem, repoOutbox, mensagens, eventos, criptografia };
}

describe('registrarAvisoPlanoPublicado', () => {
  it('persiste aviso de portal com texto cifrado e outbox mínimo na mesma transação', async () => {
    const ctx = criarGerenciador();

    await registrarAvisoPlanoPublicado(ctx.gerenciador, ctx.criptografia, {
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      planoId: 'plano-1',
      versaoId: 'versao-1'
    });

    expect(ctx.mensagens).toHaveLength(1);
    expect(ctx.mensagens[0]).toEqual(expect.objectContaining({
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      canalId: undefined,
      templateId: undefined,
      status: 'enviado',
      payload: { evento: 'plano_publicado_portal' },
      chaveIdempotencia: 'plano-publicado:paciente-1:versao-1:portal'
    }));
    expect(ctx.criptografia.criptografar).toHaveBeenCalledWith(expect.stringContaining('Um novo plano alimentar'));
    expect(JSON.stringify(ctx.mensagens[0])).not.toContain('Um novo plano alimentar');
    expect(ctx.eventos).toEqual([expect.objectContaining({
      tenantId: 'tenant-1',
      tipo: 'plano_alimentar.publicado',
      status: 'pendente',
      payload: { pacienteId: 'paciente-1', planoId: 'plano-1', versaoId: 'versao-1' }
    })]);
  });

  it('não cria outro aviso nem evento ao repetir a mesma versão', async () => {
    const ctx = criarGerenciador(true);

    await registrarAvisoPlanoPublicado(ctx.gerenciador, ctx.criptografia, {
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      planoId: 'plano-1',
      versaoId: 'versao-1'
    });

    expect(ctx.repoMensagem.save).not.toHaveBeenCalled();
    expect(ctx.repoOutbox.save).not.toHaveBeenCalled();
  });
});
