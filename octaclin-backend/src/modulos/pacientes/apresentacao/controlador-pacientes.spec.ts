import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { CHAVE_PAPEIS, CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AtualizarTarefaAcompanhamentoDto } from '../aplicacao/dtos';
import { ServicoImportacaoPacientes } from '../aplicacao/servico-importacao-pacientes';
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

  function criarCenario(servicos: Record<string, unknown> = {}) {
    const atualizarTarefaAcompanhamento = jest.fn().mockResolvedValue({
      id: 'tarefa-1',
      status: 'concluida'
    });
    const registrar = jest.fn().mockResolvedValue(undefined);
    const controlador = new ControladorPacientes(
      { atualizarTarefaAcompanhamento, ...servicos } as unknown as ServicoPacientes,
      {
        previa: jest.fn(),
        importar: jest.fn().mockResolvedValue({
          total: 3,
          validos: 1,
          duplicados: 1,
          invalidos: 1,
          bloqueadosPorPlano: 0,
          criados: 1,
          convitesCriados: 1,
          linhas: []
        }),
        ...servicos
      } as unknown as ServicoImportacaoPacientes,
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

  describe('exportacao e importacao em massa', () => {
    it('registra na auditoria o volume exportado, nao so o clique', async () => {
      const { controlador, registrar, requisicao } = criarCenario({
        exportarCsv: jest.fn().mockResolvedValue('id,nome\n1,Maria\n2,Joao\n')
      });

      const csv = await controlador.exportarCsv(usuario, requisicao, { pagina: 1, limite: 25, status: 'novo' } as never);

      expect(csv).toContain('Maria');
      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'pacientes.exportar_csv',
          metadados: expect.objectContaining({ linhas: 2 })
        })
      );
    });

    it('registra na auditoria o resultado da importacao', async () => {
      const { controlador, registrar, requisicao } = criarCenario();

      await controlador.importar(usuario, requisicao, { conteudo: 'nome\nMaria' });

      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          acao: 'pacientes.importar_csv',
          metadados: expect.objectContaining({
            total: 3,
            criados: 1,
            duplicados: 1,
            invalidos: 1,
            convitesCriados: 1
          })
        })
      );
    });

    it('exige gerenciar para importar e listar para exportar', () => {
      expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorPacientes.prototype.importar)).toEqual([
        'pacientes.gerenciar'
      ]);
      expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorPacientes.prototype.previaImportacao)).toEqual([
        'pacientes.gerenciar'
      ]);
      expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorPacientes.prototype.exportarCsv)).toEqual([
        'pacientes.listar'
      ]);
    });
  });

  describe('lixeira e restauracao', () => {
    it('audita leitura da lixeira e restauracao do paciente', async () => {
      const listarArquivados = jest.fn().mockResolvedValue({ itens: [], total: 0 });
      const restaurar = jest.fn().mockResolvedValue(undefined);
      const { controlador, registrar, requisicao } = criarCenario({ listarArquivados, restaurar });

      await controlador.listarArquivados(usuario, requisicao, 1, 25);
      await controlador.restaurar(usuario, requisicao, 'paciente-1');

      expect(listarArquivados).toHaveBeenCalledWith('tenant-1', usuario, 1, 25);
      expect(restaurar).toHaveBeenCalledWith('tenant-1', 'paciente-1', usuario);
      expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'pacientes.lixeira.listar' }));
      expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ acao: 'pacientes.restaurar', recursoId: 'paciente-1' }));
    });

    it('protege lixeira e restauracao com as permissoes adequadas', () => {
      expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorPacientes.prototype.listarArquivados)).toEqual(['pacientes.listar']);
      expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorPacientes.prototype.restaurar)).toEqual(['pacientes.gerenciar']);
    });
  });
});
