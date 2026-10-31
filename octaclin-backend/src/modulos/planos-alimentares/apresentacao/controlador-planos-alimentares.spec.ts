import { CHAVE_PAPEIS, CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
import { HEADERS_METADATA, PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoPlanosAlimentares } from '../aplicacao/servico-planos-alimentares';
import { ControladorCatalogoAlimentos, ControladorPlanosAlimentares } from './controlador-planos-alimentares';

const usuario: UsuarioAutenticado = {
  usuarioId: '10000000-0000-4000-8000-000000000001',
  tenantId: '10000000-0000-4000-8000-000000000002',
  papel: 'Professional',
  emailHash: 'hash',
  permissoes: ['planos_alimentares.ler', 'planos_alimentares.gerenciar']
};

describe('ControladorPlanosAlimentares', () => {
  const pacienteId = '10000000-0000-4000-8000-000000000003';
  const planoId = '10000000-0000-4000-8000-000000000004';
  let servico: Record<string, jest.Mock>;
  let controlador: ControladorPlanosAlimentares;

  beforeEach(() => {
    servico = {
      listar: jest.fn().mockResolvedValue([]),
      listarEscolhasPaciente: jest.fn().mockResolvedValue({ itens: [], total: 0 }),
      obter: jest.fn().mockResolvedValue({ id: planoId }),
      obterApresentacaoPaciente: jest.fn().mockResolvedValue({ numeroVersao: 1 }),
      obterVersao: jest.fn().mockResolvedValue({ numero: 0 }),
      obterAcompanhamentoVersao: jest.fn().mockResolvedValue({ versao: { numero: 0 } }),
      criar: jest.fn().mockResolvedValue({ id: planoId }),
      obterRascunho: jest.fn().mockResolvedValue({ id: planoId }),
      atualizarRascunho: jest.fn().mockResolvedValue({ id: planoId }),
      revisar: jest.fn().mockResolvedValue({ id: planoId }),
      publicar: jest.fn().mockResolvedValue({ id: planoId }),
      criarNovaVersao: jest.fn().mockResolvedValue({ id: planoId }),
      arquivar: jest.fn().mockResolvedValue({ id: planoId })
    };
    controlador = new ControladorPlanosAlimentares(servico as unknown as ServicoPlanosAlimentares);
  });

  it('FOOD06 registra análise factual com leitura e resposta sem cache', () => {
    const metodo = (ControladorPlanosAlimentares.prototype as unknown as Record<string, unknown>).analisarMicronutrientes;
    expect(typeof metodo).toBe('function');
    if (typeof metodo === 'function') {
      expect(Reflect.getMetadata(PATH_METADATA, metodo)).toBe('analise-micronutrientes');
      expect(Reflect.getMetadata(METHOD_METADATA, metodo)).toBe(1);
      expect(Reflect.getMetadata(CHAVE_PERMISSOES, metodo)).toEqual(['planos_alimentares.ler']);
      expect(Reflect.getMetadata(HEADERS_METADATA, metodo)).toContainEqual({name:'Cache-Control',value:'private, no-store'});
    }
  });

  it('restringe toda a API a SuperAdmin e Professional', () => {
    expect(Reflect.getMetadata(CHAVE_PAPEIS, ControladorPlanosAlimentares)).toEqual([
      'SuperAdmin',
      'Professional'
    ]);
  });

  it('PA06 protege a rota de edição parcial com gerenciamento e no-store', () => {
    const metodo = (ControladorPlanosAlimentares.prototype as unknown as Record<string, unknown>).salvarEdicao;
    expect(typeof metodo).toBe('function');
    if (typeof metodo === 'function') {
      expect(Reflect.getMetadata(CHAVE_PERMISSOES, metodo)).toEqual(['planos_alimentares.gerenciar']);
      expect(Reflect.getMetadata(HEADERS_METADATA, metodo)).toContainEqual({ name: 'Cache-Control', value: 'private, no-store' });
    }
  });

  it.each(['listar', 'listarEscolhasPaciente', 'obter', 'obterRascunho', 'obterVersao', 'obterAcompanhamentoVersao', 'obterApresentacaoPaciente'] as const)('usa somente planos_alimentares.ler em %s', (metodo) => {
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorPlanosAlimentares.prototype[metodo])).toEqual([
      'planos_alimentares.ler'
    ]);
  });

  it.each(['criar', 'atualizarRascunho', 'revisar', 'publicar', 'criarNovaVersao', 'arquivar'] as const)(
    'usa somente planos_alimentares.gerenciar em %s',
    (metodo) => {
      expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorPlanosAlimentares.prototype[metodo])).toEqual([
        'planos_alimentares.gerenciar'
      ]);
    }
  );

  it.each(['obterVersao', 'obterAcompanhamentoVersao', 'obterApresentacaoPaciente'] as const)(
    'marca %s como resposta clinica privada sem cache',
    (metodo) => {
      expect(Reflect.getMetadata(HEADERS_METADATA, ControladorPlanosAlimentares.prototype[metodo])).toContainEqual({
        name: 'Cache-Control',
        value: 'private, no-store'
      });
    }
  );

  it('encaminha tenant, paciente, plano e usuario para o servico', async () => {
    await controlador.obterApresentacaoPaciente(usuario, pacienteId, planoId, 1);
    expect(servico.obterApresentacaoPaciente).toHaveBeenCalledWith(usuario.tenantId, pacienteId, planoId, 1, usuario);
    await controlador.listar(usuario, pacienteId, { pagina: 1, limite: 25 });
    expect(servico.listar).toHaveBeenCalledWith(usuario.tenantId, pacienteId, usuario, { pagina: 1, limite: 25 });

    await controlador.obter(usuario, pacienteId, planoId);
    expect(servico.obter).toHaveBeenCalledWith(usuario.tenantId, pacienteId, planoId, usuario);

    await controlador.listarEscolhasPaciente(usuario, pacienteId, planoId, { pagina: 1, limite: 25 });
    expect(servico.listarEscolhasPaciente).toHaveBeenCalledWith(
      usuario.tenantId,
      pacienteId,
      planoId,
      usuario,
      { pagina: 1, limite: 25 }
    );

    await controlador.publicar(usuario, pacienteId, planoId);
    expect(servico.publicar).toHaveBeenCalledWith(usuario.tenantId, pacienteId, planoId, usuario);

    await controlador.obterVersao(usuario, pacienteId, planoId, 0);
    expect(servico.obterVersao).toHaveBeenCalledWith(usuario.tenantId, pacienteId, planoId, 0, usuario);

    const consulta = { paginaCheckins: 1, paginaQuestionarios: 1, paginaEscolhas: 1, limite: 25 };
    await controlador.obterAcompanhamentoVersao(usuario, pacienteId, planoId, 0, consulta);
    expect(servico.obterAcompanhamentoVersao).toHaveBeenCalledWith(
      usuario.tenantId,
      pacienteId,
      planoId,
      0,
      usuario,
      consulta
    );
  });
});

describe('ControladorCatalogoAlimentos', () => {
  it('mantem papel profissional e permissao propria de leitura', async () => {
    const servico = { buscarAlimentos: jest.fn().mockResolvedValue([]) };
    const controlador = new ControladorCatalogoAlimentos(servico as unknown as ServicoPlanosAlimentares);

    expect(Reflect.getMetadata(CHAVE_PAPEIS, ControladorCatalogoAlimentos)).toEqual([
      'SuperAdmin',
      'Professional'
    ]);
    expect(Reflect.getMetadata(CHAVE_PERMISSOES, ControladorCatalogoAlimentos.prototype.buscar)).toEqual([
      'planos_alimentares.ler'
    ]);
    const consulta = { busca: 'arroz', pagina: 1, limite: 25 };
    await controlador.buscar(usuario, consulta);
    expect(servico.buscarAlimentos).toHaveBeenCalledWith(usuario.tenantId, usuario, consulta);
  });
});
