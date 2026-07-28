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
    const registrar = jest.fn().mockResolvedValue(undefined);
    const controlador = new ControladorAgenda(
      { registrarDesfecho } as unknown as ServicoAgenda,
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
});
