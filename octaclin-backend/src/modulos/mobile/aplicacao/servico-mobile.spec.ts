import * as crypto from 'crypto';
import { NotFoundException } from '@nestjs/common';
import { FindOperator } from 'typeorm';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { PacienteOrm } from '../../pacientes/infraestrutura/paciente.orm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AcompanhanteOrm } from '../infraestrutura/acompanhante.orm';
import { ArquivoMidiaOrm } from '../infraestrutura/arquivo-midia.orm';
import { LogDiarioRapidoOrm } from '../infraestrutura/log-diario-rapido.orm';
import { SincronizacaoMobileOrm } from '../infraestrutura/sincronizacao-mobile.orm';
import { SincronizarLoteMobileDto } from './dtos';
import { ServicoMobile } from './servico-mobile';

const usuarios: Record<'Patient' | 'Professional' | 'SuperAdmin' | 'Collaborator', UsuarioAutenticado> = {
  Patient: {
    usuarioId: 'usuario-paciente-1',
    tenantId: 'tenant-1',
    papel: 'Patient',
    emailHash: 'hash-paciente',
    permissoes: []
  },
  Professional: {
    usuarioId: 'usuario-profissional-1',
    tenantId: 'tenant-1',
    papel: 'Professional',
    emailHash: 'hash-profissional',
    permissoes: []
  },
  SuperAdmin: {
    usuarioId: 'usuario-admin-1',
    tenantId: 'tenant-1',
    papel: 'SuperAdmin',
    emailHash: 'hash-admin',
    permissoes: []
  },
  Collaborator: {
    usuarioId: 'usuario-colaborador-1',
    tenantId: 'tenant-1',
    papel: 'Collaborator',
    emailHash: 'hash-colaborador',
    permissoes: []
  }
};

interface RepositorioFake<T extends Record<string, unknown>> {
  create: jest.Mock;
  save: jest.Mock;
  find: jest.Mock;
  findOne: jest.Mock;
  registros: T[];
}

interface DadosCenario {
  pacientes?: Array<Record<string, unknown>>;
  profissionais?: Array<Record<string, unknown>>;
  diarios?: Array<Record<string, unknown>>;
  arquivos?: Array<Record<string, unknown>>;
  acompanhantes?: Array<Record<string, unknown>>;
  sincronizacoes?: Array<Record<string, unknown>>;
}

function valorCorresponde(atual: unknown, esperado: unknown): boolean {
  if (esperado instanceof FindOperator) {
    if (esperado.type === 'isNull') return atual === null || atual === undefined;
    if (esperado.type === 'in') return (esperado.value as unknown[]).includes(atual);
  }

  return atual === esperado;
}

function filtrar<T extends Record<string, unknown>>(registros: T[], where: Record<string, unknown> = {}): T[] {
  return registros.filter((registro) =>
    Object.entries(where).every(([campo, esperado]) => valorCorresponde(registro[campo], esperado))
  );
}

function criarRepositorioFake<T extends Record<string, unknown>>(
  nome: string,
  registrosIniciais: T[] = []
): RepositorioFake<T> {
  const registros = [...registrosIniciais];
  let sequencia = 0;
  const repositorio: RepositorioFake<T> = {
    registros,
    create: jest.fn((entrada: T) => ({
      id: `${nome}-${++sequencia}`,
      criadoEm: new Date('2026-07-28T12:00:00.000Z'),
      ...entrada
    })),
    save: jest.fn(async (entrada: T) => {
      registros.push(entrada);
      return entrada;
    }),
    find: jest.fn(async (opcoes?: { where?: Record<string, unknown> }) =>
      filtrar(registros, opcoes?.where)
    ),
    findOne: jest.fn(async (opcoes: { where: Record<string, unknown> }) =>
      filtrar(registros, opcoes.where)[0] ?? null
    )
  };

  return repositorio;
}

function criarServico(dados: DadosCenario = {}) {
  const repositorios = {
    paciente: criarRepositorioFake('paciente', dados.pacientes ?? []),
    profissional: criarRepositorioFake('profissional', dados.profissionais ?? []),
    diario: criarRepositorioFake('diario', dados.diarios ?? []),
    arquivo: criarRepositorioFake('arquivo', dados.arquivos ?? []),
    acompanhante: criarRepositorioFake('acompanhante', dados.acompanhantes ?? []),
    sincronizacao: criarRepositorioFake('sincronizacao', dados.sincronizacoes ?? [])
  };
  const gerenciador = {
    getRepository: jest.fn((entidade: unknown) => {
      if (entidade === PacienteOrm) return repositorios.paciente;
      if (entidade === ProfissionalOrm) return repositorios.profissional;
      if (entidade === LogDiarioRapidoOrm) return repositorios.diario;
      if (entidade === ArquivoMidiaOrm) return repositorios.arquivo;
      if (entidade === AcompanhanteOrm) return repositorios.acompanhante;
      if (entidade === SincronizacaoMobileOrm) return repositorios.sincronizacao;
      throw new Error('Repositorio nao mapeado');
    })
  };
  const executorTenant = {
    executar: jest.fn((_tenantId: string, operacao: (gerenciador: unknown) => Promise<unknown>) =>
      operacao(gerenciador)
    )
  };
  const criptografia = { criptografar: jest.fn((valor: string) => `enc:${valor}`) };
  const senhas = { gerarHash: jest.fn((valor: string) => `hash:${valor}`) };
  const servico = new ServicoMobile(executorTenant as never, criptografia as never, senhas as never);

  return {
    servico,
    repositorios,
    criptografia,
    senhas
  };
}

function dadosComDoisPacientes(): DadosCenario {
  const criadoEm = new Date('2026-07-28T10:00:00.000Z');
  return {
    pacientes: [
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
    ],
    profissionais: [
      {
        id: 'profissional-1',
        tenantId: 'tenant-1',
        usuarioId: 'usuario-profissional-1'
      }
    ],
    diarios: [
      { id: 'diario-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', registradoEm: criadoEm },
      { id: 'diario-2', tenantId: 'tenant-1', pacienteId: 'paciente-2', registradoEm: criadoEm }
    ],
    arquivos: [
      { id: 'arquivo-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', criadoEm },
      { id: 'arquivo-2', tenantId: 'tenant-1', pacienteId: 'paciente-2', criadoEm }
    ],
    acompanhantes: [
      { id: 'acompanhante-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', ativo: true, criadoEm },
      { id: 'acompanhante-2', tenantId: 'tenant-1', pacienteId: 'paciente-2', ativo: true, criadoEm }
    ]
  };
}

describe('ServicoMobile', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('filtra diario, midias e acompanhantes do Patient antes de consultar os recursos', async () => {
    const { servico } = criarServico(dadosComDoisPacientes());

    const [diarios, arquivos, acompanhantes] = await Promise.all([
      servico.listarDiarioRapido('tenant-1', usuarios.Patient),
      servico.listarArquivosMidia('tenant-1', usuarios.Patient),
      servico.listarAcompanhantes('tenant-1', usuarios.Patient)
    ]);

    expect(diarios.map((item) => item.id)).toEqual(['diario-1']);
    expect(arquivos.map((item) => item.id)).toEqual(['arquivo-1']);
    expect(acompanhantes.map((item) => item.id)).toEqual(['acompanhante-1']);
  });

  it('filtra diario, midias e acompanhantes pelos pacientes do Professional', async () => {
    const { servico } = criarServico(dadosComDoisPacientes());

    const [diarios, arquivos, acompanhantes] = await Promise.all([
      servico.listarDiarioRapido('tenant-1', usuarios.Professional),
      servico.listarArquivosMidia('tenant-1', usuarios.Professional),
      servico.listarAcompanhantes('tenant-1', usuarios.Professional)
    ]);

    expect(diarios.map((item) => item.id)).toEqual(['diario-1']);
    expect(arquivos.map((item) => item.id)).toEqual(['arquivo-1']);
    expect(acompanhantes.map((item) => item.id)).toEqual(['acompanhante-1']);
  });

  it.each([usuarios.SuperAdmin, usuarios.Collaborator])(
    'preserva visao tenant-wide nas listagens para $papel',
    async (usuario) => {
      const { servico } = criarServico(dadosComDoisPacientes());

      const [diarios, arquivos, acompanhantes] = await Promise.all([
        servico.listarDiarioRapido('tenant-1', usuario),
        servico.listarArquivosMidia('tenant-1', usuario),
        servico.listarAcompanhantes('tenant-1', usuario)
      ]);

      expect(diarios.map((item) => item.id)).toEqual(['diario-1', 'diario-2']);
      expect(arquivos.map((item) => item.id)).toEqual(['arquivo-1', 'arquivo-2']);
      expect(acompanhantes.map((item) => item.id)).toEqual(['acompanhante-1', 'acompanhante-2']);
    }
  );

  it('rejeita diario de outro paciente para Patient sem persistir', async () => {
    const { servico, repositorios } = criarServico(dadosComDoisPacientes());

    await expect(
      servico.registrarDiarioRapido(
        'tenant-1',
        { pacienteId: 'paciente-2', tipo: 'humor', valor: { nivel: 4 } },
        usuarios.Patient
      )
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repositorios.diario.save).not.toHaveBeenCalled();
  });

  it('rejeita acompanhante de paciente nao vinculado ao Professional sem persistir', async () => {
    const { servico, repositorios } = criarServico(dadosComDoisPacientes());

    await expect(
      servico.criarAcompanhante(
        'tenant-1',
        { pacienteId: 'paciente-2', nome: 'Contato', pin: '1234' },
        usuarios.Professional
      )
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repositorios.acompanhante.save).not.toHaveBeenCalled();
  });

  it('valida escopo do upload antes de gerar a chave ou persistir o arquivo', async () => {
    const randomUuid = jest.spyOn(crypto, 'randomUUID');
    const { servico, repositorios } = criarServico(dadosComDoisPacientes());

    await expect(
      servico.solicitarUploadMidia(
        'tenant-1',
        {
          pacienteId: 'paciente-2',
          tipo: 'imagem',
          mimeType: 'image/jpeg',
          tamanhoBytes: 100
        },
        usuarios.Patient
      )
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(randomUuid).not.toHaveBeenCalled();
    expect(repositorios.arquivo.save).not.toHaveBeenCalled();
  });

  it('permite escrita do Patient somente no paciente derivado da sessao', async () => {
    const { servico, repositorios } = criarServico(dadosComDoisPacientes());

    const diario = await servico.registrarDiarioRapido(
      'tenant-1',
      { pacienteId: 'paciente-1', tipo: 'humor', valor: { nivel: 5 } },
      usuarios.Patient
    );

    expect(diario).toEqual(expect.objectContaining({ tenantId: 'tenant-1', pacienteId: 'paciente-1' }));
    expect(repositorios.diario.registros).toEqual(
      expect.arrayContaining([expect.objectContaining({ pacienteId: 'paciente-1' })])
    );
  });

  it('cria acompanhante autorizado criptografado e retorna apenas resumo seguro', async () => {
    const { servico, criptografia, senhas } = criarServico(dadosComDoisPacientes());

    const acompanhante = await servico.criarAcompanhante(
      'tenant-1',
      {
        pacienteId: 'paciente-1',
        nome: 'Contato sensivel',
        contato: '+5511999999999',
        pin: '1234'
      },
      usuarios.Professional
    );

    expect(criptografia.criptografar).toHaveBeenCalledWith('Contato sensivel');
    expect(senhas.gerarHash).toHaveBeenCalledWith('1234');
    expect(acompanhante).toEqual(expect.objectContaining({ tenantId: 'tenant-1', pacienteId: 'paciente-1', ativo: true }));
    expect(acompanhante).not.toHaveProperty('pinHash');
    expect(acompanhante).not.toHaveProperty('nomeCriptografado');
    expect(acompanhante).not.toHaveProperty('contatoCriptografado');
  });

  it.each([
    ['diario_rapido', { pacienteId: 'paciente-2', tipo: 'humor', valor: { nivel: 1 } }],
    ['midia_captura', { pacienteId: 'paciente-2', mimeType: 'image/jpeg', tamanhoBytes: 50 }],
    ['midia_audio', { pacienteId: 'paciente-2', mimeType: 'audio/m4a', tamanhoBytes: 50, duracaoSegundos: 10 }],
    ['acompanhante', { pacienteId: 'paciente-2', nome: 'Contato', pin: '1234' }]
  ] as const)(
    'rejeita payload %s fora do escopo no lote antes de persistir',
    async (tipo, payload) => {
      const { servico, repositorios } = criarServico(dadosComDoisPacientes());

      const resultado = await servico.sincronizarLote(
        'tenant-1',
        { itens: [{ idLocal: `local-${tipo}`, tipo, payload }] },
        usuarios.Patient
      );

      expect(resultado.resultados).toEqual([
        {
          idLocal: `local-${tipo}`,
          status: 'erro',
          erro: 'Paciente nao encontrado.'
        }
      ]);
      expect(repositorios.diario.save).not.toHaveBeenCalled();
      expect(repositorios.arquivo.save).not.toHaveBeenCalled();
      expect(repositorios.acompanhante.save).not.toHaveBeenCalled();
      expect(repositorios.sincronizacao.save).not.toHaveBeenCalled();
    }
  );

  it('nao retorna recurso de outro paciente em colisao com idLocal legado', async () => {
    const dados = dadosComDoisPacientes();
    dados.diarios?.push({
      id: 'diario-paciente-2',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-2',
      registradoEm: new Date('2026-07-28T10:00:00.000Z')
    });
    dados.sincronizacoes = [
      {
        id: 'sync-legado',
        tenantId: 'tenant-1',
        idLocal: 'local-colidido',
        tipo: 'diario_rapido',
        recursoTipo: 'diario_rapido',
        recursoId: 'diario-paciente-2'
      }
    ];
    const { servico, repositorios } = criarServico(dados);

    const resultado = await servico.sincronizarLote(
      'tenant-1',
      {
        itens: [
          {
            idLocal: 'local-colidido',
            tipo: 'diario_rapido',
            payload: { pacienteId: 'paciente-1', tipo: 'humor', valor: { nivel: 4 } }
          }
        ]
      },
      usuarios.Patient
    );

    expect(resultado.resultados[0]).toEqual(
      expect.objectContaining({
        idLocal: 'local-colidido',
        status: 'sincronizado',
        recursoId: expect.not.stringMatching(/^diario-paciente-2$/)
      })
    );
    expect(repositorios.diario.save).toHaveBeenCalledWith(
      expect.objectContaining({ pacienteId: 'paciente-1' })
    );
    expect(repositorios.sincronizacao.save).toHaveBeenCalledWith(
      expect.objectContaining({ idLocal: expect.not.stringMatching(/^local-colidido$/) })
    );
  });

  it('reaproveita idLocal legado somente quando o recurso pertence ao paciente autorizado', async () => {
    const dados = dadosComDoisPacientes();
    dados.diarios?.push({
      id: 'diario-legado',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      registradoEm: new Date('2026-07-28T10:00:00.000Z')
    });
    dados.sincronizacoes = [
      {
        id: 'sync-legado',
        tenantId: 'tenant-1',
        idLocal: 'local-legado',
        tipo: 'diario_rapido',
        recursoTipo: 'diario_rapido',
        recursoId: 'diario-legado'
      }
    ];
    const { servico, repositorios } = criarServico(dados);

    const resultado = await servico.sincronizarLote(
      'tenant-1',
      {
        itens: [
          {
            idLocal: 'local-legado',
            tipo: 'diario_rapido',
            payload: { pacienteId: 'paciente-1', tipo: 'humor', valor: { nivel: 4 } }
          }
        ]
      },
      usuarios.Patient
    );

    expect(resultado.resultados).toEqual([
      { idLocal: 'local-legado', status: 'sincronizado', recursoId: 'diario-legado' }
    ]);
    expect(repositorios.diario.save).not.toHaveBeenCalled();
    expect(repositorios.sincronizacao.save).not.toHaveBeenCalled();
  });

  it('preserva idempotencia por paciente para novas sincronizacoes', async () => {
    const { servico, repositorios } = criarServico(dadosComDoisPacientes());
    const lote: SincronizarLoteMobileDto = {
      itens: [
        {
          idLocal: 'local-novo',
          tipo: 'diario_rapido',
          payload: { pacienteId: 'paciente-1', tipo: 'humor', valor: { nivel: 4 } }
        }
      ]
    };

    const primeira = await servico.sincronizarLote('tenant-1', lote, usuarios.Patient);
    const segunda = await servico.sincronizarLote('tenant-1', lote, usuarios.Patient);

    expect(segunda.resultados).toEqual(primeira.resultados);
    expect(repositorios.diario.save).toHaveBeenCalledTimes(1);
    expect(repositorios.sincronizacao.save).toHaveBeenCalledTimes(1);
    expect(repositorios.sincronizacao.registros.at(-1)?.idLocal).not.toBe('local-novo');
  });
});
