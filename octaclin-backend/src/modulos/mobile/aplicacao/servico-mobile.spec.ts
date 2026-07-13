import { AcompanhanteOrm } from '../infraestrutura/acompanhante.orm';
import { ArquivoMidiaOrm } from '../infraestrutura/arquivo-midia.orm';
import { LogDiarioRapidoOrm } from '../infraestrutura/log-diario-rapido.orm';
import { SincronizacaoMobileOrm } from '../infraestrutura/sincronizacao-mobile.orm';
import { ServicoMobile } from './servico-mobile';

function criarRepositorioFake(nome: string, dados: Record<string, unknown>) {
  return {
    create: jest.fn((entrada: Record<string, unknown>) => ({ id: `${nome}-1`, criadoEm: new Date(), ...entrada })),
    save: jest.fn(async (entrada: Record<string, unknown>) => entrada),
    find: jest.fn(async () => dados.lista ?? []),
    findOne: jest.fn(async () => dados.syncExistente ?? null)
  };
}

function criarServico(dados: Record<string, unknown> = {}) {
  const repositorios = {
    diario: criarRepositorioFake('diario', dados),
    arquivo: criarRepositorioFake('arquivo', dados),
    acompanhante: criarRepositorioFake('acompanhante', dados),
    sincronizacao: criarRepositorioFake('sincronizacao', dados)
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === LogDiarioRapidoOrm) return repositorios.diario;
      if (entidade === ArquivoMidiaOrm) return repositorios.arquivo;
      if (entidade === AcompanhanteOrm) return repositorios.acompanhante;
      if (entidade === SincronizacaoMobileOrm) return repositorios.sincronizacao;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };
  const criptografia = { criptografar: jest.fn((valor: string) => `enc:${valor}`) };
  const senhas = { gerarHash: jest.fn((valor: string) => `hash:${valor}`) };

  return { servico: new ServicoMobile(executorTenant as never, criptografia as never, senhas as never), repositorios, criptografia, senhas };
}

describe('ServicoMobile', () => {
  it('deve criar acompanhante criptografado e retornar apenas resumo seguro', async () => {
    const { servico, criptografia, senhas } = criarServico();

    const acompanhante = await servico.criarAcompanhante('tenant-1', {
      pacienteId: 'paciente-1',
      nome: 'Contato sensivel',
      contato: '+5511999999999',
      pin: '1234'
    });

    expect(criptografia.criptografar).toHaveBeenCalledWith('Contato sensivel');
    expect(senhas.gerarHash).toHaveBeenCalledWith('1234');
    expect(acompanhante).toEqual(expect.objectContaining({ tenantId: 'tenant-1', pacienteId: 'paciente-1', ativo: true }));
    expect(acompanhante).not.toHaveProperty('pinHash');
    expect(acompanhante).not.toHaveProperty('nomeCriptografado');
    expect(acompanhante).not.toHaveProperty('contatoCriptografado');
  });

  it('deve sincronizar lote de forma idempotente quando idLocal ja existe', async () => {
    const { servico, repositorios } = criarServico({
      syncExistente: { idLocal: 'local-1', recursoId: 'recurso-existente' }
    });

    const resultado = await servico.sincronizarLote('tenant-1', {
      itens: [{ idLocal: 'local-1', tipo: 'diario_rapido', payload: { pacienteId: 'paciente-1', tipo: 'humor', valor: {} } }]
    });

    expect(resultado.resultados).toEqual([{ idLocal: 'local-1', status: 'sincronizado', recursoId: 'recurso-existente' }]);
    expect(repositorios.diario.save).not.toHaveBeenCalled();
  });
});
