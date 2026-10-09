import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { NotificacaoOrm } from '../infraestrutura/notificacao.orm';
import { PreferenciaNotificacaoUsuarioOrm } from '../infraestrutura/preferencia-notificacao-usuario.orm';
import { ResumoNotificacaoUsuarioOrm } from '../infraestrutura/resumo-notificacao-usuario.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { ServicoPreferenciasNotificacoes } from './servico-preferencias-notificacoes';

const usuario: UsuarioAutenticado = {
  usuarioId: '00000000-0000-4000-8000-000000000001', tenantId: '00000000-0000-4000-8000-000000000002',
  papel: 'Professional', emailHash: 'hash', permissoes: ['console.acessar']
};

function criarServico(papel = 'Professional') {
  let preferencia: Partial<PreferenciaNotificacaoUsuarioOrm> | null = null;
  const repoPreferencia = {
    findOne: jest.fn(async () => preferencia),
    create: jest.fn((dados) => dados),
    save: jest.fn(async (dados) => { preferencia = dados; return dados; })
  };
  const repoUsuario = { findOne: jest.fn(async () => ({ ativo: true, role: papel })) };
  const repoNotificacao = { update: jest.fn(async () => ({ affected: 2 })) };
  const repoResumo = { update: jest.fn(async () => ({ affected: 1 })) };
  const manager = {
    getRepository: jest.fn((tipo: { name: string }) => {
      if (tipo === PreferenciaNotificacaoUsuarioOrm) return repoPreferencia;
      if (tipo === UsuarioOrm) return repoUsuario;
      if (tipo === NotificacaoOrm) return repoNotificacao;
      if (tipo === ResumoNotificacaoUsuarioOrm) return repoResumo;
      throw new Error(`Repositorio nao mapeado: ${tipo.name}`);
    })
  };
  const executor = { executar: jest.fn((_tenantId, operacao) => operacao(manager)) };
  return {
    servico: new ServicoPreferenciasNotificacoes(executor as never), repoPreferencia, repoUsuario,
    repoNotificacao, repoResumo, executor, manager
  };
}

describe('ServicoPreferenciasNotificacoes', () => {
  it('retorna padroes imediatos sem criar registro e expoe somente classes elegiveis', async () => {
    const { servico, repoPreferencia } = criarServico();
    const resultado = await servico.obter(usuario);
    expect(resultado.modos).toEqual({ formulario_respondido: 'imediato', tarefa_concluida: 'imediato', automacao_executada: 'imediato' });
    expect(resultado.timezone).toBe('America/Sao_Paulo');
    expect(resultado.emailResumo).toBe(false);
    expect(resultado.classesElegiveis).toHaveLength(3);
    expect(repoPreferencia.save).not.toHaveBeenCalled();
  });

  it('trava snapshot novo e opt-in de e-mail sem aceitar classes de obrigatorias', async () => {
    const { servico, repoUsuario, repoPreferencia } = criarServico();
    const resultado = await servico.salvar(usuario, {
      modos: { formulario_respondido: 'diario', tarefa_concluida: 'semanal', automacao_executada: 'imediato' },
      timezone: 'America/Sao_Paulo', emailResumo: true
    });
    expect(repoUsuario.findOne).toHaveBeenCalledWith(expect.objectContaining({ lock: { mode: 'pessimistic_write' } }));
    expect(repoPreferencia.save).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: usuario.tenantId, usuarioId: usuario.usuarioId,
      modoFormularioRespondido: 'diario', modoTarefaConcluida: 'semanal', emailResumo: true
    }));
    expect(resultado.tiposObrigatorios).toEqual(['mensagem_recebida', 'solicitacao_agendamento', 'falha_envio']);
  });

  it('ao desligar e-mail cancela eventos ainda sem resumo e envios ainda pendentes', async () => {
    const { servico, repoNotificacao, repoResumo } = criarServico();
    await servico.salvar(usuario, {
      modos: { formulario_respondido: 'diario', tarefa_concluida: 'diario', automacao_executada: 'semanal' },
      timezone: 'America/Sao_Paulo', emailResumo: false
    });
    expect(repoNotificacao.update).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: usuario.tenantId, usuarioId: usuario.usuarioId, resumoId: expect.anything(), emailResumo: true }),
      expect.objectContaining({ emailCanceladoEm: expect.any(Date) })
    );
    expect(repoResumo.update).toHaveBeenCalledWith(
      expect.objectContaining({ estadoEmail: 'pendente', tenantId: usuario.tenantId }),
      expect.objectContaining({ estadoEmail: 'cancelado' })
    );
  });

  it('rejeita email sem digest, fuso invalido e usuario desativado', async () => {
    const { servico, repoUsuario } = criarServico();
    await expect(servico.salvar(usuario, {
      modos: { formulario_respondido: 'imediato', tarefa_concluida: 'silenciado', automacao_executada: 'imediato' },
      timezone: 'America/Sao_Paulo', emailResumo: true
    })).rejects.toThrow('Ative pelo menos um resumo interno');
    await expect(servico.obter(usuario)).resolves.toBeDefined();
    repoUsuario.findOne.mockResolvedValueOnce({ ativo: false, role: 'Professional' } as never);
    await expect(servico.obter(usuario)).rejects.toThrow();
  });

  it('Collaborator nao pode escolher classes nem receber digest por email', async () => {
    const { servico } = criarServico('Collaborator');
    const colaborador = { ...usuario, papel: 'Collaborator' as const };
    const resultado = await servico.obter(colaborador);
    expect(resultado.classesElegiveis).toEqual([]);
    expect(resultado.emailResumo).toBe(false);
    await expect(servico.salvar(colaborador, {
      modos: { formulario_respondido: 'semanal', tarefa_concluida: 'imediato', automacao_executada: 'imediato' },
      timezone: 'America/Sao_Paulo', emailResumo: true
    })).rejects.toThrow();
  });
});
