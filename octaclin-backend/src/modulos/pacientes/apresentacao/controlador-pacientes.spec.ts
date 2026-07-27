import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { CHAVE_PAPEIS, CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AtualizarTarefaAcompanhamentoDto } from '../aplicacao/dtos';
import { ServicoPacientes } from '../aplicacao/servico-pacientes';
import { ControladorPacientes } from './controlador-pacientes';

describe('ControladorPacientes', () => {
  const usuario: UsuarioAutenticado = {
    usuarioId: 'usuario-1',
    tenantId: 'tenant-1',
    papel: 'Professional',
    emailHash: 'hash',
    permissoes: ['pacientes.gerenciar']
  };
  const dados: AtualizarTarefaAcompanhamentoDto = { status: 'concluida' };

  function criarCenario() {
    const atualizarTarefaAcompanhamento = jest.fn().mockResolvedValue({
      id: 'tarefa-1',
      status: 'concluida'
    });
    const registrar = jest.fn().mockResolvedValue(undefined);
    const controlador = new ControladorPacientes(
      { atualizarTarefaAcompanhamento } as unknown as ServicoPacientes,
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

    await controlador.atualizarTarefaAcompanhamento(
      usuario,
      requisicao,
      'paciente-1',
      'tarefa-1',
      dados
    );

    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        metadados: {
          tarefaId: 'tarefa-1',
          status: 'concluida',
          origem: 'pacientes'
        }
      })
    );
    expect(requisicao.header).not.toHaveBeenCalled();
  });

  it('fixa origem e papeis clinicos no endpoint do dashboard', async () => {
    const { controlador, registrar, requisicao } = criarCenario();
    const atualizarDashboard = (
      controlador as unknown as {
        atualizarTarefaAcompanhamentoDashboard(
          usuario: UsuarioAutenticado,
          requisicao: Request,
          pacienteId: string,
          tarefaId: string,
          dados: AtualizarTarefaAcompanhamentoDto
        ): Promise<unknown>;
      }
    ).atualizarTarefaAcompanhamentoDashboard;

    await atualizarDashboard.call(
      controlador,
      usuario,
      requisicao,
      'paciente-1',
      'tarefa-1',
      dados
    );

    expect(registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        metadados: {
          tarefaId: 'tarefa-1',
          status: 'concluida',
          origem: 'dashboard_clinico'
        }
      })
    );
    expect(Reflect.getMetadata(CHAVE_PAPEIS, atualizarDashboard)).toEqual([
      'SuperAdmin',
      'Professional'
    ]);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, atualizarDashboard)).toEqual([
      'pacientes.gerenciar'
    ]);
  });
});
