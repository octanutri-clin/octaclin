import { ServicoGestaoIntegracoes } from './servico-gestao-integracoes';
import { WebhookAssinaturaOrm } from '../infraestrutura/webhook-assinatura.orm';
import { WebhookEntregaOrm } from '../infraestrutura/webhook-entrega.orm';
import { validarDestinoWebhook } from './seguranca-destino-webhook';

jest.mock('./seguranca-destino-webhook', () => ({ validarDestinoWebhook: jest.fn(async () => undefined) }));

describe('ServicoGestaoIntegracoes', () => {
  it('profissional ve apenas as proprias chaves, mesmo quando outras tem os mesmos escopos', async () => {
    const chaves = [
      { id: 'chave-propria', escopos: ['pacientes:ler'], profissionalUsuarioId: 'profissional-1' },
      { id: 'chave-de-outro', escopos: ['pacientes:ler'], profissionalUsuarioId: 'profissional-2' },
      { id: 'chave-da-clinica', escopos: ['pacientes:ler'] }
    ];
    const repositorio = { find: jest.fn(async () => chaves) };
    const executor = {
      executar: jest.fn((_tenant: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao({ getRepository: () => repositorio })
      )
    };
    const concessao = {
      obterConcessaoNoGerenciador: jest.fn(async () => ({ escoposApi: ['pacientes:ler'] }))
    };
    const servico = new ServicoGestaoIntegracoes(
      executor as never, {} as never, { registrar: jest.fn() } as never, concessao as never
    );

    await expect(servico.listarChaves('tenant-1', { usuarioId: 'profissional-1' }))
      .resolves.toEqual([expect.objectContaining({ id: 'chave-propria' })]);
    expect(repositorio.find).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantId: 'tenant-1', profissionalUsuarioId: 'profissional-1' }
    }));
  });

  it('nao permite reprocessar entrega que ja foi confirmada', async () => {
    const repositorio = { findOne: jest.fn(async () => null), save: jest.fn() };
    const executor = {
      executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao({ getRepository: () => repositorio })
      )
    };
    const auditoria = { registrar: jest.fn() };
    const servico = new ServicoGestaoIntegracoes(executor as never, {} as never, auditoria as never, {} as never);

    await expect(servico.reprocessarEntrega('tenant-1', 'usuario-1', 'entrega-confirmada'))
      .rejects.toThrow('Entrega de webhook com falha nao encontrada.');
    expect(repositorio.findOne).toHaveBeenCalledWith({
      where: { id: 'entrega-confirmada', tenantId: 'tenant-1', status: 'falhou' }
    });
    expect(repositorio.save).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('nunca devolve o segredo criptografado ao listar webhooks', async () => {
    const executor = {
      executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
        operacao({
          getRepository: () => ({
            find: jest.fn(async () => [{
              id: 'webhook-1',
              nome: 'Automacao',
              url: 'https://example.com/webhook',
              eventos: ['paciente.criado'],
              ativo: true,
              segredoCriptografado: Buffer.from('nao-pode-sair'),
              criadoEm: new Date(),
              atualizadoEm: new Date()
            }])
          })
        })
      )
    };
    const servico = new ServicoGestaoIntegracoes(executor as never, {} as never, { registrar: jest.fn() } as never, {} as never);
    const resposta = await servico.listarWebhooks('tenant-1');
    expect(JSON.stringify(resposta)).not.toContain('segredo');
    expect(JSON.stringify(resposta)).not.toContain('nao-pode-sair');
  });

  it('projeta entregas em DTO sem payload nem erro externo bruto', async () => {
    const entrega = {
      id: 'entrega-1', assinaturaId: 'webhook-1', evento: 'paciente.criado', status: 'falhou',
      tentativas: 2, ultimoStatusHttp: 503, ultimoErro: 'url interna revelada',
      payload: { dadoSensivel: 'nao-retornar' }, criadoEm: new Date()
    };
    const repositorioWebhooks = { find: jest.fn(async () => [{
      id: 'webhook-1', eventos: ['paciente.criado'], profissionalUsuarioId: 'profissional-1'
    }]) };
    const repositorioEntregas = { find: jest.fn(async () => [entrega]) };
    const gerenciador = { getRepository: (entidade: unknown) => entidade === WebhookAssinaturaOrm ? repositorioWebhooks : repositorioEntregas };
    const executor = { executar: jest.fn(async (_tenant: string, operacao: (manager: unknown) => Promise<unknown>) => operacao(gerenciador)) };
    const concessao = { obterConcessaoNoGerenciador: jest.fn(async () => ({ eventosWebhook: ['paciente.criado'], escoposApi: [] })) };
    const servico = new ServicoGestaoIntegracoes(executor as never, {} as never, { registrar: jest.fn() } as never, concessao as never);

    const resposta = await servico.listarEntregas('tenant-1', { usuarioId: 'profissional-1' });

    expect(resposta).toEqual([expect.objectContaining({
      id: 'entrega-1', ultimoErro: 'A entrega falhou. Consulte o endpoint de destino e tente novamente.'
    })]);
    expect(JSON.stringify(resposta)).not.toContain('dadoSensivel');
    expect(JSON.stringify(resposta)).not.toContain('url interna revelada');
    expect(repositorioEntregas.find).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId: 'tenant-1' }) }));
  });

  it('nega reprocessamento quando o webhook relacionado contém eventos fora da concessão', async () => {
    const entrega = {
      id: 'entrega-1', assinaturaId: 'webhook-1', evento: 'consulta.criada', status: 'falhou',
      tentativas: 2, payload: {}, criadoEm: new Date()
    };
    const repositorioEntregas = { findOne: jest.fn(async () => entrega), save: jest.fn() };
    const repositorioWebhooks = { findOne: jest.fn(async () => ({
      id: 'webhook-1', eventos: ['paciente.criado', 'consulta.criada'], profissionalUsuarioId: 'profissional-1'
    })) };
    const gerenciador = { getRepository: (entidade: unknown) => entidade === WebhookAssinaturaOrm ? repositorioWebhooks : repositorioEntregas };
    const executor = { executar: jest.fn(async (_tenant: string, operacao: (manager: unknown) => Promise<unknown>) => operacao(gerenciador)) };
    const concessao = { obterConcessaoNoGerenciador: jest.fn(async () => ({ eventosWebhook: ['paciente.criado'], escoposApi: [] })) };
    const servico = new ServicoGestaoIntegracoes(executor as never, {} as never, { registrar: jest.fn() } as never, concessao as never);

    await expect(servico.reprocessarEntrega('tenant-1', 'profissional-1', 'entrega-1', { usuarioId: 'profissional-1' }))
      .rejects.toThrow('Eventos solicitados não estão disponíveis para esta integração.');
    expect(repositorioEntregas.save).not.toHaveBeenCalled();
  });

  it('nega evento não autorizado antes de validar destino webhook com DNS', async () => {
    const concessao = {
      obterAcessoAtual: jest.fn(async () => ({ escoposApi: [], eventosWebhook: ['paciente.criado'] }))
    };
    const servico = new ServicoGestaoIntegracoes({ executar: jest.fn() } as never, {} as never, { registrar: jest.fn() } as never, concessao as never);

    await expect(servico.criarWebhook('tenant-1', 'profissional-1', {
      nome: 'Webhook', url: 'https://example.com/hook', eventos: ['consulta.criada']
    }, { usuarioId: 'profissional-1' })).rejects.toThrow('Eventos solicitados não estão disponíveis para esta integração.');

    expect(validarDestinoWebhook).not.toHaveBeenCalled();
  });
});
