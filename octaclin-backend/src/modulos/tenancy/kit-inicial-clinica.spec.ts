import {
  CHAVES_KIT_INICIAL_CLINICA,
  interpretarMarcadorKitInicial
} from './kit-inicial-clinica';

describe('interpretarMarcadorKitInicial', () => {
  it('trata a ausência de marcador como kit ainda não instalado', () => {
    expect(interpretarMarcadorKitInicial(undefined)).toEqual({
      estado: 'nao_instalado',
      versao: undefined,
      itensInstalados: []
    });
  });

  it('preserva o marcador legado como kit completo', () => {
    expect(interpretarMarcadorKitInicial({ versao: 1 })).toEqual({
      estado: 'completo',
      versao: 1,
      itensInstalados: [...CHAVES_KIT_INICIAL_CLINICA]
    });
  });

  it('normaliza a seleção parcial para a ordem canônica', () => {
    expect(interpretarMarcadorKitInicial({
      versao: 2,
      itens: ['estrutura:cinco-refeicoes', 'material:registro-habitos']
    })).toEqual({
      estado: 'parcial',
      versao: 2,
      itensInstalados: ['material:registro-habitos', 'estrutura:cinco-refeicoes']
    });
  });

  it('reconhece a seleção completa da versão atual', () => {
    expect(interpretarMarcadorKitInicial({ versao: 2, itens: [...CHAVES_KIT_INICIAL_CLINICA] }).estado)
      .toBe('completo');
  });

  it('aceita metadados opcionais bem formados', () => {
    expect(interpretarMarcadorKitInicial({
      versao: 2,
      itens: ['material:registro-habitos'],
      instaladoEm: '2026-10-10T09:30:00.000Z',
      atualizadoEm: '2026-10-10T09:30:00Z',
      origem: 'opt_in_cliente'
    }).estado).toBe('parcial');
  });

  it('bloqueia versões futuras sem reinterpretá-las', () => {
    expect(interpretarMarcadorKitInicial({ versao: 3 }).estado).toBe('incompativel');
  });

  it.each([
    { versao: 2, itens: [] },
    { versao: 2, itens: ['nao-existe'] },
    { versao: 2, itens: ['material:registro-habitos', 'material:registro-habitos'] },
    { versao: 2, itens: 'material:registro-habitos' },
    { versao: 2, itens: ['material:registro-habitos'], instaladoEm: 'ontem' },
    { versao: 2, itens: ['material:registro-habitos'], instaladoEm: '2026-02-30T10:00:00Z' },
    { versao: 2, itens: ['material:registro-habitos'], atualizadoEm: null },
    { versao: 2, itens: ['material:registro-habitos'], origem: 'inventada' },
    { versao: '2', itens: ['material:registro-habitos'] },
    null
  ])('marca payloads inválidos como inconsistentes (%p)', (valor) => {
    expect(interpretarMarcadorKitInicial(valor).estado).toBe('inconsistente');
  });
});
