import { CHAVE_PAPEIS, CHAVE_PERMISSOES } from '../../auth/apresentacao/decorators';
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
      obter: jest.fn().mockResolvedValue({ id: planoId }),
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

  it('restringe toda a API a SuperAdmin e Professional', () => {
    expect(Reflect.getMetadata(CHAVE_PAPEIS, ControladorPlanosAlimentares)).toEqual([
      'SuperAdmin',
      'Professional'
    ]);
  });

  it.each(['listar', 'obter', 'obterRascunho'] as const)('usa somente planos_alimentares.ler em %s', (metodo) => {
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

  it('encaminha tenant, paciente, plano e usuario para o servico', async () => {
    await controlador.obter(usuario, pacienteId, planoId);
    expect(servico.obter).toHaveBeenCalledWith(usuario.tenantId, pacienteId, planoId, usuario);

    await controlador.publicar(usuario, pacienteId, planoId);
    expect(servico.publicar).toHaveBeenCalledWith(usuario.tenantId, pacienteId, planoId, usuario);
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
    await controlador.buscar(usuario, 'arroz');
    expect(servico.buscarAlimentos).toHaveBeenCalledWith(usuario.tenantId, 'arroz', usuario);
  });
});
