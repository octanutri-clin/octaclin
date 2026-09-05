import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { CHAVE_PAPEIS, CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { RegistrarDesfechoConsultaAgendaDto } from '../aplicacao/dtos';
import { ServicoAgendamentoPublico } from '../aplicacao/servico-agendamento-publico';
import { ServicoAgenda } from '../aplicacao/servico-agenda';
import { ControladorAgenda } from './controlador-agenda';

describe('ControladorAgenda', () => {
  const usuario: UsuarioAutenticado = {
    usuarioId: 'usuario-1',
    tenantId: 'tenant-1',
    papel: 'Professional',
    emailHash: 'hash',
    permissoes: ['agenda.consultas.criar']
  };
  const dados: RegistrarDesfechoConsultaAgendaDto = { status: 'concluida' };

  function criarCenario() {
    const registrarDesfecho = jest.fn().mockResolvedValue({
      id: 'consulta-1',
      status: 'concluida'
    });
    const cancelarConsulta = jest.fn().mockResolvedValue({ id: 'consulta-1', googleEventId: 'evt-1' });
    const registrar = jest.fn().mockResolvedValue(undefined);
    const controlador = new ControladorAgenda(
      { registrarDesfecho, cancelarConsulta } as unknown as ServicoAgenda,
      {} as ServicoAgendamentoPublico,
      { registrar } as unknown as ServicoAuditoria
    );
    const requisicao = {
      header: jest.fn().mockReturnValue('dashboard_clinico'),
      headers: { 'user-agent': 'jest' },
      ip: '127.0.0.1'
    } as unknown as Request;

    return { controlador, registrar, requisicao };
  }

  it('ignora origem forjada no endpoint generico', async () => {
    const { controlador, registrar, requisicao } = criarCenario();

    await controlador.registrarDesfecho(usuario, requisicao, 'consulta-1', dados);

    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        metadados: {
          status: 'concluida',
          origem: 'agenda'
        }
      })
    );
    expect(requisicao.header).not.toHaveBeenCalled();
  });

  it('fixa origem e papeis clinicos no endpoint do dashboard', async () => {
    const { controlador, registrar, requisicao } = criarCenario();
    const registrarDashboard = (
      controlador as unknown as {
        registrarDesfechoDashboard(
          usuario: UsuarioAutenticado,
          requisicao: Request,
          consultaId: string,
          dados: RegistrarDesfechoConsultaAgendaDto
        ): Promise<unknown>;
      }
    ).registrarDesfechoDashboard;

    await registrarDashboard.call(controlador, usuario, requisicao, 'consulta-1', dados);

    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        metadados: {
          status: 'concluida',
          origem: 'dashboard_clinico'
        }
      })
    );
    expect(Reflect.getMetadata(CHAVE_PAPEIS, registrarDashboard)).toEqual([
      'SuperAdmin',
      'Professional'
    ]);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, registrarDashboard)).toEqual([
      'agenda.consultas.criar'
    ]);
  });

  /**
   * Teste negativo do vazamento que este PR fechou. `motivo` e texto livre de
   * ate 500 caracteres e, num cancelamento de consulta, rotineiramente clinico.
   * O call site irmao de `agenda.solicitacao.recusar` ja gravava
   * `possuiMotivo`; era o mesmo campo do mesmo fluxo gravado de duas formas.
   */
  it('nao deve deixar o motivo do cancelamento chegar a trilha de auditoria', async () => {
    const { controlador, registrar, requisicao } = criarCenario();

    await controlador.cancelarConsulta(usuario, requisicao, 'consulta-1', {
      motivo: 'internada apos crise, remarcar depois da alta'
    });

    const entrada = registrar.mock.calls[0][0] as { metadados: Record<string, unknown> };

    expect(JSON.stringify(entrada.metadados)).not.toContain('internada');
    expect(entrada.metadados).toEqual({ possuiMotivo: true, googleEventId: 'evt-1' });
  });

  it('deve declarar ausencia de motivo em vez de omitir o campo', async () => {
    const { controlador, registrar, requisicao } = criarCenario();

    await controlador.cancelarConsulta(usuario, requisicao, 'consulta-1', {});

    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({ metadados: { possuiMotivo: false, googleEventId: 'evt-1' } })
    );
  });
});
