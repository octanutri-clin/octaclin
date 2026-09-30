import { ForbiddenException, BadRequestException, HttpException } from '@nestjs/common';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PROFISSIONAL_SENTINELA_INEXISTENTE } from '../../../infraestrutura/seguranca/escopo-profissional';
import { TenantConfiguracaoOrm } from '../../tenancy/infraestrutura/tenant-configuracao.orm';
import { ConversaPortalPacienteOrm, MensagemPortalPacienteOrm } from '../infraestrutura/conversa-portal-paciente.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { ServicoConversaPortalPaciente } from './servico-conversa-portal-paciente';

function montarServico(configuracao?: Record<string, unknown>) {
  const paciente = {
    id: 'paciente-a',
    tenantId: 'tenant-a',
    usuarioId: 'usuario-paciente-a',
    nomeCriptografado: Buffer.from('cifra:Paciente Sintetico'),
    profissionalResponsavelId: 'profissional-a',
    statusCicloVida: 'ACTIVE'
  };
  const conversas: Record<string, any>[] = [];
  const mensagens: Record<string, any>[] = [];
  const repository = (itens: Record<string, any>[], prefixo: string) => ({
    findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
      itens.find((item) => Object.entries(where).every(([chave, valor]) => item[chave] === valor)) ?? null
    ),
    find: jest.fn(async ({ where, order, skip, take }: {
      where: Record<string, unknown>;
      order?: Record<string, 'ASC' | 'DESC'>;
      skip?: number;
      take?: number;
    }) => {
      const resultado = itens.filter((item) => Object.entries(where).every(([chave, valor]) => item[chave] === valor));
      const ordenacoes = Object.entries(order ?? {});
      resultado.sort((a, b) => {
        for (const [campo, direcao] of ordenacoes) {
          const aValor = a[campo] instanceof Date ? a[campo].getTime() : a[campo];
          const bValor = b[campo] instanceof Date ? b[campo].getTime() : b[campo];
          if (aValor !== bValor) return direcao === 'DESC' ? (aValor < bValor ? 1 : -1) : (aValor < bValor ? -1 : 1);
        }
        return 0;
      });
      return resultado.slice(skip ?? 0, take === undefined ? undefined : (skip ?? 0) + take);
    }),
    create: jest.fn((dados: Record<string, unknown>) => ({ id: `${prefixo}-${itens.length + 1}`, ...dados })),
    save: jest.fn(async (item: Record<string, any>) => {
      const existente = itens.findIndex((atual) => atual.id === item.id);
      const salvo = { criadoEm: new Date(), ...item };
      if (existente >= 0) itens[existente] = salvo;
      else itens.push(salvo);
      return salvo;
    })
  });
  const repositorios = new Map<unknown, any>([
    [PacienteOrm, repository([paciente], 'paciente')],
    [TenantConfiguracaoOrm, repository(configuracao ? [{ tenantId: 'tenant-a', chave: 'conta_cliente', valor: configuracao }] : [], 'config')],
    [ConversaPortalPacienteOrm, repository(conversas, 'conversa')],
    [MensagemPortalPacienteOrm, repository(mensagens, 'mensagem')]
  ]);
  const gerenciador = {
    query: jest.fn(async (sql: string) => sql.includes('count(*)::int as total')
      ? [{ total: mensagens.filter((mensagem) => mensagem.autorTipo === 'paciente' && mensagem.criadoEm.getTime() > Date.now() - 10 * 60 * 1000).length }]
      : [{ id: paciente.id }]
    ),
    getRepository: jest.fn((entidade: unknown) => repositorios.get(entidade) ?? { findOne: jest.fn(async () => null) })
  };
  const executorTenant = { executar: jest.fn((_tenantId: string, operacao: (manager: unknown) => Promise<unknown>) => operacao(gerenciador)) };
  const criptografia = {
    criptografar: jest.fn((texto: string) => Buffer.from(texto).toString('base64')),
    descriptografar: jest.fn((valor: Buffer) => Buffer.from(valor.toString(), 'base64').toString())
  };
  return {
    servico: new ServicoConversaPortalPaciente(executorTenant as never, criptografia as never),
    executorTenant,
    gerenciador,
    paciente,
    conversas,
    mensagens,
    criptografia
  };
}

const pacienteAutenticado: UsuarioAutenticado = {
  usuarioId: 'usuario-paciente-a', tenantId: 'tenant-a', papel: 'Patient', emailHash: 'hash', permissoes: []
};

const superAdmin: UsuarioAutenticado = {
  usuarioId: 'usuario-admin-a', tenantId: 'tenant-a', papel: 'SuperAdmin', emailHash: 'hash',
  permissoes: ['pacientes.ler', 'comunicacoes.mensagens.ler', 'comunicacoes.mensagens.enviar']
};

describe('ServicoConversaPortalPaciente', () => {
  it('cifra mensagem do paciente e inicia ciclo com SLA configurado em horas corridas', async () => {
    const { servico, conversas, mensagens, criptografia } = montarServico({ slaRespostaPacienteHoras: 1 });
    const antes = Date.now();

    const conversa = await servico.enviarMensagemPaciente('tenant-a', pacienteAutenticado.usuarioId, '  Preciso de ajuda  ');

    expect(conversa.status).toBe('aguardando_clinica');
    expect(conversa.atrasada).toBe(false);
    expect(conversa.prazoRespostaEm!.getTime()).toBeGreaterThanOrEqual(antes + 60 * 60 * 1000);
    expect(conversa.prazoRespostaEm!.getTime()).toBeLessThanOrEqual(Date.now() + 60 * 60 * 1000);
    expect(mensagens[0].conteudoCriptografado.toString()).not.toContain('Preciso de ajuda');
    expect(criptografia.criptografar).toHaveBeenCalledWith('Preciso de ajuda');
    expect(conversas).toHaveLength(1);
  });

  it('usa 24 horas quando configuracao antiga ou invalida nao possui SLA suportado', async () => {
    const { servico } = montarServico({ slaRespostaPacienteHoras: 500 });
    const antes = Date.now();

    const conversa = await servico.enviarMensagemPaciente('tenant-a', pacienteAutenticado.usuarioId, 'Mensagem');

    expect(conversa.prazoRespostaEm!.getTime()).toBeGreaterThanOrEqual(antes + 24 * 60 * 60 * 1000);
  });

  it('nao permite texto vazio ou acima do limite', async () => {
    const { servico, gerenciador } = montarServico();
    await expect(servico.enviarMensagemPaciente('tenant-a', pacienteAutenticado.usuarioId, '  ')).rejects.toBeInstanceOf(BadRequestException);
    await expect(servico.enviarMensagemPaciente('tenant-a', pacienteAutenticado.usuarioId, 'x'.repeat(5001))).rejects.toBeInstanceOf(BadRequestException);
    expect(gerenciador.query).not.toHaveBeenCalled();
  });

  it('limita cinco mensagens do paciente por janela móvel de dez minutos', async () => {
    const { servico, mensagens, gerenciador } = montarServico();
    for (let indice = 0; indice < 5; indice += 1) {
      await servico.enviarMensagemPaciente('tenant-a', pacienteAutenticado.usuarioId, `Mensagem ${indice + 1}`);
    }

    const erro = await servico.enviarMensagemPaciente('tenant-a', pacienteAutenticado.usuarioId, 'Mensagem excedente')
      .catch((rejeicao) => rejeicao);

    expect(erro).toBeInstanceOf(HttpException);
    expect((erro as HttpException).getStatus()).toBe(429);
    expect(mensagens).toHaveLength(5);
    expect(gerenciador.query).toHaveBeenCalledWith(expect.stringContaining("now() - interval '10 minutes'"), [
      'tenant-a', 'conversa-1', pacienteAutenticado.usuarioId
    ]);
  });

  it('usa somente o vínculo usuário-paciente autenticado para resolver a conversa', async () => {
    const { servico, gerenciador } = montarServico();
    gerenciador.query.mockResolvedValueOnce([]);

    await expect(servico.enviarMensagemPaciente('tenant-a', 'usuario-de-outro-paciente', 'Mensagem')).rejects.toBeInstanceOf(ForbiddenException);
    expect(gerenciador.query).toHaveBeenCalledWith(expect.stringContaining('usuario_id = $2'), ['tenant-a', 'usuario-de-outro-paciente']);
  });

  it('nega acesso da equipe sem permissão explícita de leitura', async () => {
    const { servico, executorTenant } = montarServico();
    const colaborador: UsuarioAutenticado = {
      usuarioId: 'colaborador-a', tenantId: 'tenant-a', papel: 'Collaborator', emailHash: 'hash',
      permissoes: ['pacientes.ler']
    };

    await expect(servico.listarFila('tenant-a', colaborador)).rejects.toBeInstanceOf(ForbiddenException);
    expect(executorTenant.executar).not.toHaveBeenCalled();
  });

  it('nega tenant informado que diverge da identidade autenticada', async () => {
    const { servico, executorTenant } = montarServico();

    await expect(servico.listarFila('tenant-b', superAdmin)).rejects.toBeInstanceOf(ForbiddenException);
    expect(executorTenant.executar).not.toHaveBeenCalled();
  });

  it('mantem profissional sem vínculo no escopo vazio em vez de ampliar para o tenant', async () => {
    const { servico, conversas, gerenciador } = montarServico();
    await servico.enviarMensagemPaciente('tenant-a', pacienteAutenticado.usuarioId, 'Dúvida');
    const profissional: UsuarioAutenticado = {
      usuarioId: 'profissional-sem-vinculo', tenantId: 'tenant-a', papel: 'Professional', emailHash: 'hash',
      permissoes: ['pacientes.ler', 'comunicacoes.mensagens.ler']
    };

    const fila = await servico.listarFila('tenant-a', profissional);

    expect(fila.itens).toEqual([]);
    expect(fila).toEqual({ itens: [], pagina: 0, temMais: false });
    expect(conversas).toHaveLength(1);
    expect(gerenciador.getRepository(ConversaPortalPacienteOrm).find).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ profissionalResponsavelId: PROFISSIONAL_SENTINELA_INEXISTENTE })
    }));
  });

  it('pagina a fila em blocos de 100 sem perder o indicador de próxima página', async () => {
    const { servico, conversas } = montarServico();
    const vencimento = new Date('2026-09-30T16:00:00.000Z');
    conversas.push(...Array.from({ length: 101 }, (_, indice) => ({
      id: `conversa-${String(indice).padStart(3, '0')}`,
      tenantId: 'tenant-a',
      pacienteId: 'paciente-a',
      profissionalResponsavelId: 'profissional-a',
      status: 'aguardando_clinica',
      ultimaMensagemEm: new Date(vencimento.getTime() - indice * 1000),
      prazoRespostaEm: vencimento,
      criadoEm: vencimento
    })));

    const primeiraPagina = await servico.listarFila('tenant-a', superAdmin, false, 0);
    const segundaPagina = await servico.listarFila('tenant-a', superAdmin, false, 1);

    expect(primeiraPagina.itens).toHaveLength(100);
    expect(primeiraPagina).toMatchObject({ pagina: 0, temMais: true });
    expect(segundaPagina.itens).toHaveLength(1);
    expect(segundaPagina).toMatchObject({ pagina: 1, temMais: false });
  });

  it('rejeita páginas negativas ou que não possam ser representadas com segurança', async () => {
    const { servico, executorTenant } = montarServico();

    await expect(servico.listarFila('tenant-a', superAdmin, false, -1)).rejects.toBeInstanceOf(BadRequestException);
    await expect(servico.listarFila('tenant-a', superAdmin, false, Number.NaN)).rejects.toBeInstanceOf(BadRequestException);
    expect(executorTenant.executar).not.toHaveBeenCalled();
  });

  it('filtra estados da conversa no servidor e restringe atraso às pendências da clínica', async () => {
    const { servico, gerenciador, executorTenant } = montarServico();

    await servico.listarFila('tenant-a', superAdmin, false, 0, 'aguardando_paciente');
    expect(gerenciador.getRepository(ConversaPortalPacienteOrm).find).toHaveBeenLastCalledWith(expect.objectContaining({
      where: expect.objectContaining({ status: 'aguardando_paciente' })
    }));

    await expect(servico.listarFila('tenant-a', superAdmin, true, 0, 'encerrada')).rejects.toBeInstanceOf(BadRequestException);
    await expect(servico.listarFila('tenant-a', superAdmin, false, 0, 'status-invalido' as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(executorTenant.executar).toHaveBeenCalledTimes(1);
  });

  it('resposta da equipe fecha o ciclo de SLA e nao retorna a mensagem sem descriptografar', async () => {
    const { servico, conversas, mensagens } = montarServico();
    const conversa = await servico.enviarMensagemPaciente('tenant-a', pacienteAutenticado.usuarioId, 'Dúvida');

    const resposta = await servico.responderEquipe('tenant-a', superAdmin, conversa.id, 'Resposta clínica');

    expect(resposta.status).toBe('aguardando_paciente');
    expect(resposta.prazoRespostaEm).toBeUndefined();
    expect(resposta.mensagens.map((mensagem) => mensagem.autor)).toEqual(['paciente', 'equipe']);
    expect(mensagens).toHaveLength(2);
    expect(conversas[0].prazoRespostaEm).toBeUndefined();
  });
});
