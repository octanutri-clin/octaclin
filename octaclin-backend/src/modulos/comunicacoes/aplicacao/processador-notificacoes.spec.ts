import { ProcessadorNotificacoes } from './processador-notificacoes';
import { CanalNotificacaoOrm } from '../infraestrutura/canal-notificacao.orm';
import { MensagemNotificacaoOrm } from '../infraestrutura/mensagem-notificacao.orm';
import { TemplateMensagemOrm } from '../infraestrutura/template-mensagem.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';

function criarProcessador(adaptadorEmail: { enviar: jest.Mock }) {
  const mensagem = {
    id: 'mensagem-1',
    tenantId: 'tenant-1',
    canalId: 'canal-1',
    templateId: 'template-1',
    status: 'pendente',
    erro: undefined as string | undefined,
    payload: { destino: 'paciente@example.com' }
  };
  const canal = { id: 'canal-1', tenantId: 'tenant-1', tipo: 'email' };
  const template = { id: 'template-1', tenantId: 'tenant-1', canal: 'email' };
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
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === MensagemNotificacaoOrm) return repositorioMensagens;
      if (entidade === CanalNotificacaoOrm) return repositorioCanais;
      if (entidade === TemplateMensagemOrm) return repositorioTemplates;
      if (entidade === UsuarioOrm) return repositorioUsuarios;
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

  return { processador, mensagem, repositorioMensagens };
}

describe('ProcessadorNotificacoes', () => {
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
});
