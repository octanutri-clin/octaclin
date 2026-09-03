import { Request } from 'express';
import { ServicoAuditoria } from '../../../infraestrutura/auditoria/servico-auditoria';
import { CHAVE_PAPEIS, CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AtualizarTarefaAcompanhamentoDto } from '../aplicacao/dtos';
import { ServicoDuplicidadePacientes } from '../aplicacao/servico-duplicidade-pacientes';
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
    const registrarDispensa = jest.fn().mockResolvedValue(undefined);
    const verificarDuplicidade = jest.fn().mockResolvedValue({ candidatos: [] });
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
      { registrar } as unknown as ServicoAuditoria,
      { verificar: verificarDuplicidade, registrarDispensa } as unknown as ServicoDuplicidadePacientes
    );
    const requisicao = {
      header: jest.fn().mockReturnValue('dashboard_clinico'),
      headers: { 'user-agent': 'jest' },
      ip: '127.0.0.1'
    } as unknown as Request;

    return { controlador, registrar, registrarDispensa, verificarDuplicidade, requisicao };
  }

  it('registra somente os UUIDs dispensados depois de criar o paciente', async () => {
    const criar = jest.fn().mockResolvedValue({ id: 'paciente-novo' });
    const { controlador, registrarDispensa, verificarDuplicidade, requisicao } = criarCenario({ criar });
    const candidatos = ['4fd25c2d-556d-4b48-9aaa-d45177cd0d4c'];
    verificarDuplicidade.mockResolvedValue({
      candidatos: [{ pacienteId: candidatos[0], nome: 'Outra pessoa', motivos: ['nome'] }]
    });

    await controlador.criar(usuario, requisicao, {
      profissionalResponsavelId: '76349fd1-39f5-4c62-995d-6b987600271d',
      nome: 'Pessoa sintetica',
      candidatosDuplicidadeDispensados: candidatos
    });

    expect(registrarDispensa).toHaveBeenCalledWith(
      usuario.tenantId,
      usuario,
      'paciente-novo',
      candidatos
    );
  });

  it('rejeita UUIDs dispensados que nao pertencem ao resultado autorizado', async () => {
    const criar = jest.fn().mockResolvedValue({ id: 'paciente-novo' });
    const { controlador, registrarDispensa, verificarDuplicidade, requisicao } = criarCenario({ criar });
    verificarDuplicidade.mockResolvedValue({ candidatos: [] });

    await expect(controlador.criar(usuario, requisicao, {
      profissionalResponsavelId: '76349fd1-39f5-4c62-995d-6b987600271d',
      nome: 'Pessoa sintetica',
      candidatosDuplicidadeDispensados: ['4fd25c2d-556d-4b48-9aaa-d45177cd0d4c']
    })).rejects.toThrow('Revise novamente os possíveis cadastros semelhantes');

    expect(criar).not.toHaveBeenCalled();
    expect(registrarDispensa).not.toHaveBeenCalled();
  });

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

    /**
     * Teste negativo do vazamento que este PR fechou: o call site gravava
     * `filtros: { ...filtros }`, e `ListarPacientesDto.busca` e o texto de ate
     * 180 caracteres que a recepcao digitou -- nome de paciente, pedaco de CPF,
     * telefone. `servico-pacientes.ts` passa esse mesmo campo por
     * `gerarHashesConsultaPii` justamente para nunca armazena-lo, e a trilha
     * desfazia isso ao lado.
     *
     * A afirmacao e sobre o payload serializado inteiro, e nao sobre a chave
     * `busca`: o ponto e que o termo nao existe em lugar nenhum da trilha, nem
     * aninhado, nem sob outro nome.
     */
    it('nao deve deixar o termo de busca digitado chegar a trilha de auditoria', async () => {
      const { controlador, registrar, requisicao } = criarCenario({
        exportarCsv: jest.fn().mockResolvedValue('id,nome\n1,Maria\n')
      });

      await controlador.exportarCsv(usuario, requisicao, {
        pagina: 1,
        limite: 25,
        status: 'novo',
        busca: 'Maria Silva 123.456.789-09'
      } as never);

      const entrada = registrar.mock.calls[0][0] as { metadados: Record<string, unknown> };

      expect(JSON.stringify(entrada.metadados)).not.toContain('Maria Silva');
      expect(JSON.stringify(entrada.metadados)).not.toContain('123.456.789-09');
      expect(entrada.metadados).toEqual({
        linhas: 1,
        possuiBusca: true,
        pagina: 1,
        limite: 25,
        status: 'novo',
        risco: undefined,
        profissionalId: undefined
      });
    });

    it('deve declarar ausencia de busca em vez de omitir o campo', async () => {
      const { controlador, registrar, requisicao } = criarCenario({
        exportarCsv: jest.fn().mockResolvedValue('id,nome\n1,Maria\n')
      });

      await controlador.exportarCsv(usuario, requisicao, { pagina: 1, limite: 25 } as never);

      expect(registrar).toHaveBeenCalledWith(
        expect.objectContaining({ metadados: expect.objectContaining({ possuiBusca: false }) })
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
