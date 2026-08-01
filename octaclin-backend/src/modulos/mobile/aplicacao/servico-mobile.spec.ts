import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AcompanhanteOrm } from '../infraestrutura/acompanhante.orm';
import { ArquivoMidiaOrm } from '../infraestrutura/arquivo-midia.orm';
import { LogDiarioRapidoOrm } from '../infraestrutura/log-diario-rapido.orm';
import { SincronizacaoMobileOrm } from '../infraestrutura/sincronizacao-mobile.orm';
import { ServicoMobile } from './servico-mobile';

const usuarioPaciente: UsuarioAutenticado = {
  usuarioId: 'usuario-paciente-1',
  tenantId: 'tenant-1',
  papel: 'Patient',
  emailHash: 'hash-paciente',
  permissoes: []
};

const usuarioProfissional: UsuarioAutenticado = {
  usuarioId: 'usuario-profissional-1',
  tenantId: 'tenant-1',
  papel: 'Professional',
  emailHash: 'hash-profissional',
  permissoes: []
};

const usuarioSuperAdmin: UsuarioAutenticado = {
  usuarioId: 'usuario-admin-1',
  tenantId: 'tenant-1',
  papel: 'SuperAdmin',
  emailHash: 'hash-admin',
  permissoes: []
};

const usuarioColaborador: UsuarioAutenticado = {
  usuarioId: 'usuario-colaborador-1',
  tenantId: 'tenant-1',
  papel: 'Collaborator',
  emailHash: 'hash-colaborador',
  permissoes: []
};

interface DadosFake {
  pacientes?: Record<string, unknown>[];
  profissionais?: Record<string, unknown>[];
  diarios?: Record<string, unknown>[];
  arquivos?: Record<string, unknown>[];
  acompanhantes?: Record<string, unknown>[];
  sincronizacoes?: Record<string, unknown>[];
}

function correspondeValor(atual: unknown, esperado: unknown): boolean {
  if (!esperado || typeof esperado !== 'object') return atual === esperado;
  const operador = esperado as { _type?: string; _value?: unknown };
  if (operador._type === 'in') return Array.isArray(operador._value) && operador._value.includes(atual);
  if (operador._type === 'isNull') return atual === null || atual === undefined;
  return atual === esperado;
}

function filtrar(itens: Record<string, unknown>[], opcoes?: { where?: Record<string, unknown> }) {
  const where = opcoes?.where ?? {};
  return itens.filter((item) => Object.entries(where).every(([chave, valor]) => correspondeValor(item[chave], valor)));
}

function criarRepositorioFake(nome: string, itens: Record<string, unknown>[]) {
  return {
    create: jest.fn((entrada: Record<string, unknown>) => ({ id: `${nome}-1`, criadoEm: new Date(), ...entrada })),
    save: jest.fn(async (entrada: Record<string, unknown>) => entrada),
    find: jest.fn(async (opcoes?: { where?: Record<string, unknown> }) => filtrar(itens, opcoes)),
    findOne: jest.fn(async (opcoes?: { where?: Record<string, unknown> }) => filtrar(itens, opcoes)[0] ?? null)
  };
}

function criarServico(dados: DadosFake = {}) {
  const repositorios = {
    paciente: criarRepositorioFake('paciente', dados.pacientes ?? []),
    profissional: criarRepositorioFake('profissional', dados.profissionais ?? []),
    diario: criarRepositorioFake('diario', dados.diarios ?? []),
    arquivo: criarRepositorioFake('arquivo', dados.arquivos ?? []),
    acompanhante: criarRepositorioFake('acompanhante', dados.acompanhantes ?? []),
    sincronizacao: criarRepositorioFake('sincronizacao', dados.sincronizacoes ?? [])
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === PacienteOrm) return repositorios.paciente;
      if (entidade === ProfissionalOrm) return repositorios.profissional;
      if (entidade === LogDiarioRapidoOrm) return repositorios.diario;
      if (entidade === ArquivoMidiaOrm) return repositorios.arquivo;
      if (entidade === AcompanhanteOrm) return repositorios.acompanhante;
      if (entidade === SincronizacaoMobileOrm) return repositorios.sincronizacao;
      throw new Error(`Repositorio nao mapeado: ${entidade.name}`);
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) => operacao(gerenciador))
  };
  const criptografia = { criptografar: jest.fn((valor: string) => `enc:${valor}`) };
  const senhas = { gerarHash: jest.fn((valor: string) => `hash:${valor}`) };

  return {
    servico: new ServicoMobile(executorTenant as never, criptografia as never, senhas as never),
    repositorios,
    criptografia,
    senhas
  };
}

describe('ServicoMobile', () => {
  const pacientes = [
    {
      id: 'paciente-1',
      tenantId: 'tenant-1',
      usuarioId: 'usuario-paciente-1',
      profissionalResponsavelId: 'profissional-1'
    },
    {
      id: 'paciente-2',
      tenantId: 'tenant-1',
      usuarioId: 'usuario-paciente-2',
      profissionalResponsavelId: 'profissional-2'
    }
  ];

  it('deve listar para Patient apenas registros do proprio paciente', async () => {
    const { servico } = criarServico({
      pacientes,
      diarios: [
        { id: 'diario-1', tenantId: 'tenant-1', pacienteId: 'paciente-1' },
        { id: 'diario-2', tenantId: 'tenant-1', pacienteId: 'paciente-2' }
      ]
    });

    const diarios = await servico.listarDiarioRapido('tenant-1', usuarioPaciente);

    expect(diarios).toEqual([expect.objectContaining({ id: 'diario-1', pacienteId: 'paciente-1' })]);
  });

  it('deve impedir Patient de gravar para outro paciente', async () => {
    const { servico, repositorios } = criarServico({ pacientes });

    await expect(
      servico.registrarDiarioRapido(
        'tenant-1',
        { pacienteId: 'paciente-2', tipo: 'humor', valor: { escala: 4 } },
        usuarioPaciente
      )
    ).rejects.toThrow('Paciente nao encontrado.');
    expect(repositorios.diario.save).not.toHaveBeenCalled();
  });

  it('deve listar para Professional apenas pacientes sob sua responsabilidade', async () => {
    const { servico } = criarServico({
      pacientes,
      profissionais: [{ id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' }],
      arquivos: [
        { id: 'arquivo-1', tenantId: 'tenant-1', pacienteId: 'paciente-1' },
        { id: 'arquivo-2', tenantId: 'tenant-1', pacienteId: 'paciente-2' }
      ]
    });

    const arquivos = await servico.listarArquivosMidia('tenant-1', usuarioProfissional);

    expect(arquivos).toEqual([expect.objectContaining({ id: 'arquivo-1', pacienteId: 'paciente-1' })]);
  });

  it('deve impedir Professional de gravar para paciente de outro responsavel', async () => {
    const { servico, repositorios } = criarServico({
      pacientes,
      profissionais: [{ id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' }]
    });

    await expect(
      servico.criarAcompanhante(
        'tenant-1',
        { pacienteId: 'paciente-2', nome: 'Contato', pin: '1234' },
        usuarioProfissional
      )
    ).rejects.toThrow('Paciente nao encontrado.');
    expect(repositorios.acompanhante.save).not.toHaveBeenCalled();
  });

  it('deve permitir SuperAdmin acessar qualquer paciente do tenant', async () => {
    const { servico, criptografia, senhas } = criarServico({ pacientes });

    const acompanhante = await servico.criarAcompanhante(
      'tenant-1',
      { pacienteId: 'paciente-2', nome: 'Contato sensivel', contato: '+5511999999999', pin: '1234' },
      usuarioSuperAdmin
    );

    expect(criptografia.criptografar).toHaveBeenCalledWith('Contato sensivel');
    expect(senhas.gerarHash).toHaveBeenCalledWith('1234');
    expect(acompanhante).toEqual(expect.objectContaining({ tenantId: 'tenant-1', pacienteId: 'paciente-2', ativo: true }));
    expect(acompanhante).not.toHaveProperty('pinHash');
    expect(acompanhante).not.toHaveProperty('nomeCriptografado');
    expect(acompanhante).not.toHaveProperty('contatoCriptografado');
  });

  it('deve bloquear Collaborator no servico', async () => {
    const { servico } = criarServico({ pacientes });

    await expect(servico.listarAcompanhantes('tenant-1', usuarioColaborador)).rejects.toThrow(
      'Usuario sem permissao para operar mobile.'
    );
  });

  it('deve validar escopo antes de reutilizar sincronizacao idempotente', async () => {
    const { servico, repositorios } = criarServico({
      pacientes,
      sincronizacoes: [{ tenantId: 'tenant-1', idLocal: 'local-1', recursoId: 'recurso-outro-paciente' }]
    });

    const resultado = await servico.sincronizarLote(
      'tenant-1',
      {
        itens: [{ idLocal: 'local-1', tipo: 'diario_rapido', payload: { pacienteId: 'paciente-2', tipo: 'humor', valor: {} } }]
      },
      usuarioPaciente
    );

    expect(resultado.resultados).toEqual([{ idLocal: 'local-1', status: 'erro', erro: 'Paciente nao encontrado.' }]);
    expect(repositorios.diario.save).not.toHaveBeenCalled();
  });

  it('deve preservar sincronizacao idempotente do proprio paciente no app', async () => {
    const { servico, repositorios } = criarServico({
      pacientes,
      sincronizacoes: [{ tenantId: 'tenant-1', pacienteId: 'paciente-1', idLocal: 'local-proprio', recursoId: 'recurso-existente' }]
    });

    const resultado = await servico.sincronizarLote(
      'tenant-1',
      {
        itens: [
          {
            idLocal: 'local-proprio',
            tipo: 'diario_rapido',
            payload: { pacienteId: 'paciente-1', tipo: 'humor', valor: {} }
          }
        ]
      },
      usuarioPaciente
    );

    expect(resultado.resultados).toEqual([
      { idLocal: 'local-proprio', status: 'sincronizado', recursoId: 'recurso-existente' }
    ]);
    expect(repositorios.diario.save).not.toHaveBeenCalled();
  });

  it('nao reutiliza recurso de outro paciente com o mesmo id local', async () => {
    const { servico, repositorios } = criarServico({
      pacientes,
      sincronizacoes: [{ tenantId: 'tenant-1', pacienteId: 'paciente-1', idLocal: 'local-repetido', recursoId: 'recurso-paciente-1' }]
    });

    const resultado = await servico.sincronizarLote(
      'tenant-1',
      {
        itens: [
          {
            idLocal: 'local-repetido',
            tipo: 'diario_rapido',
            payload: { pacienteId: 'paciente-2', tipo: 'humor', valor: {} }
          }
        ]
      },
      usuarioSuperAdmin
    );

    expect(resultado.resultados[0]).toEqual(
      expect.objectContaining({ idLocal: 'local-repetido', status: 'sincronizado' })
    );
    expect(resultado.resultados[0]?.recursoId).not.toBe('recurso-paciente-1');
    expect(repositorios.diario.save).toHaveBeenCalled();
    expect(repositorios.sincronizacao.save).toHaveBeenCalledWith(
      expect.objectContaining({ pacienteId: 'paciente-2', idLocal: 'local-repetido' })
    );
  });
});
