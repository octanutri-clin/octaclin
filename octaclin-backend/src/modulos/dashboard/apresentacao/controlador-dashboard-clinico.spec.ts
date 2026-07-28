import { BadRequestException } from '@nestjs/common';
import { CHAVE_PAPEIS, CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { ServicoDashboardClinico } from '../aplicacao/servico-dashboard-clinico';
import { ControladorDashboardClinico } from './controlador-dashboard-clinico';

function usuario(papel: UsuarioAutenticado['papel']): UsuarioAutenticado {
  return {
    usuarioId: papel === 'SuperAdmin' ? 'usuario-admin' : 'usuario-profissional',
    tenantId: 'tenant-1',
    papel,
    emailHash: 'hash',
    permissoes: ['dashboard.ler']
  };
}

describe('ControladorDashboardClinico', () => {
  const resumo = {
    contexto: {
      periodo: 'hoje' as const,
      inicioEm: new Date('2026-07-27T03:00:00.000Z'),
      fimEm: new Date('2026-07-28T02:59:59.999Z'),
      profissionalId: '11111111-1111-4111-8111-111111111111',
      profissionalNome: 'Nome descriptografado'
    },
    indicadores: {
      consultasHoje: 0,
      proximas: 0,
      concluidas: 0,
      reagendadas: 0,
      canceladas: 0,
      faltas: 0,
      semRetorno30: 0,
      semRetorno60: 0,
      semRetorno90Mais: 0,
      formulariosPendentes: 0,
      tarefasVencidas: 0,
      solicitacoesPendentes: 0,
      comunicacoesEmAlerta: 0,
      pacientesRiscoAlto: 0
    },
    atendimentos: [],
    semRetorno: [],
    tarefasVencidas: [],
    formulariosPendentes: [],
    solicitacoesPendentes: [],
    comunicacoes: [],
    alertas: [],
    selecaoObrigatoria: false
  };

  function criarCenario() {
    const obterResumo = jest.fn().mockResolvedValue(resumo);
    const ocultarAlerta = jest.fn().mockResolvedValue({
      alertaId: 'tarefa_vencida:11111111-1111-4111-8111-111111111111:tarefa-1',
      ocultoAteEm: new Date('2026-07-28T15:00:00.000Z')
    });
    const registrar = jest.fn().mockResolvedValue(undefined);
    const controlador = new ControladorDashboardClinico(
      { obterResumo, ocultarAlerta } as unknown as ServicoDashboardClinico,
      { registrar } as unknown as ServicoAuditoria
    );
    return { controlador, obterResumo, ocultarAlerta, registrar };
  }

  it('declara somente SuperAdmin e Professional com dashboard.ler', () => {
    expect(Reflect.getMetadata(CHAVE_PAPEIS, ControladorDashboardClinico)).toEqual([
      'SuperAdmin',
      'Professional'
    ]);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorDashboardClinico)).toEqual([
      'dashboard.ler'
    ]);
  });

  it('audita selecao explicita de SuperAdmin com contexto operacional sem PII', async () => {
    const { controlador, registrar } = criarCenario();
    const profissionalId = '11111111-1111-4111-8111-111111111111';

    await controlador.obter(usuario('SuperAdmin'), {
      periodo: 'sete_dias',
      profissionalId
    });

    expect(registrar).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      usuarioId: 'usuario-admin',
      acao: 'dashboard.clinico.consultar_contexto_terceiro',
      recursoTipo: 'profissional',
      recursoId: profissionalId,
      metadados: {
        periodo: 'sete_dias'
      }
    });
    const entrada = registrar.mock.calls[0][0] as Record<string, unknown>;
    expect(entrada).not.toHaveProperty('ip');
    expect(entrada).not.toHaveProperty('userAgent');
    expect(JSON.stringify(entrada)).not.toContain('Nome descriptografado');
  });

  it('nao audita contexto forjado por Professional', async () => {
    const { controlador, obterResumo, registrar } = criarCenario();
    const profissional = usuario('Professional');
    const filtros = {
      periodo: 'hoje' as const,
      profissionalId: '22222222-2222-4222-8222-222222222222'
    };

    await controlador.obter(profissional, filtros);

    expect(obterResumo).toHaveBeenCalledWith('tenant-1', filtros, profissional);
    expect(registrar).not.toHaveBeenCalled();
  });

  it('audita ocultacao sem persistir PII ou aceitar contexto no corpo', async () => {
    const { controlador, ocultarAlerta, registrar } = criarCenario();
    const profissional = usuario('Professional');
    const alertaId = 'tarefa_vencida:11111111-1111-4111-8111-111111111111:tarefa-1';

    const resposta = await controlador.ocultarAlerta(profissional, alertaId);

    expect(ocultarAlerta).toHaveBeenCalledWith('tenant-1', alertaId, profissional);
    expect(registrar).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      usuarioId: 'usuario-profissional',
      acao: 'dashboard.clinico.alerta.ocultar',
      recursoTipo: 'dashboard_alerta',
      metadados: {
        alertaId,
        ocultoAteEm: resposta.ocultoAteEm
      }
    });
  });

  it('nao audita alerta rejeitado pelo servico', async () => {
    const { controlador, ocultarAlerta, registrar } = criarCenario();
    ocultarAlerta.mockRejectedValueOnce(new BadRequestException('Alerta indisponivel.'));

    await expect(
      controlador.ocultarAlerta(
        usuario('Professional'),
        'tarefa_vencida:11111111-1111-4111-8111-111111111111:texto-arbitrario'
      )
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(registrar).not.toHaveBeenCalled();
  });
});
