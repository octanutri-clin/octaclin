import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
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
  consultas?: Record<string, unknown>[];
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

function criarServico(dados: DadosFake = {}, usarIfNoneMatch = true) {
  const repositorios = {
    paciente: criarRepositorioFake('paciente', dados.pacientes ?? []),
    profissional: criarRepositorioFake('profissional', dados.profissionais ?? []),
    consulta: criarRepositorioFake('consulta', dados.consultas ?? []),
    diario: criarRepositorioFake('diario', dados.diarios ?? []),
    arquivo: criarRepositorioFake('arquivo', dados.arquivos ?? []),
    acompanhante: criarRepositorioFake('acompanhante', dados.acompanhantes ?? []),
    sincronizacao: criarRepositorioFake('sincronizacao', dados.sincronizacoes ?? [])
  };
  const gerenciador = {
    query: jest.fn(async () => undefined),
    getRepository: jest.fn((entidade: { name: string }) => {
      if (entidade === PacienteOrm) return repositorios.paciente;
      if (entidade === ProfissionalOrm) return repositorios.profissional;
      if (entidade === AgendaConsultaOrm) return repositorios.consulta;
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
  const armazenamento = {
    bucket: 'octaclin-midias-teste',
    usarIfNoneMatch,
    criarUploadAssinado: jest.fn(async () => 'https://upload.example/assinado'),
    inspecionarObjeto: jest.fn(async () => ({
      tamanhoBytes: 321,
      mimeType: 'application/pdf',
      hashConteudo: 'sha256-real'
    })),
    criarDownloadAssinado: jest.fn(async () => 'https://download.example/assinado'),
    promoverObjeto: jest.fn(async () => undefined),
    excluirObjeto: jest.fn(async () => undefined)
  };
  const portalCliente = {
    checarLimite: jest.fn(async () => ({ permitido: true, restante: null }))
  };

  return {
    servico: new ServicoMobile(
      executorTenant as never,
      criptografia as never,
      senhas as never,
      armazenamento as never,
      portalCliente as never
    ),
    repositorios,
    criptografia,
    senhas,
    armazenamento,
    portalCliente
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
        { id: 'arquivo-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', status: 'confirmado' },
        { id: 'arquivo-pendente', tenantId: 'tenant-1', pacienteId: 'paciente-1', status: 'pendente' },
        { id: 'arquivo-2', tenantId: 'tenant-1', pacienteId: 'paciente-2', status: 'confirmado' }
      ]
    });

    const arquivos = await servico.listarArquivosMidia('tenant-1', usuarioProfissional);

    expect(arquivos).toEqual([expect.objectContaining({ id: 'arquivo-1', pacienteId: 'paciente-1' })]);
  });

  it('cria upload assinado sem confiar metadados do cliente', async () => {
    const { servico, repositorios, armazenamento, criptografia } = criarServico({ pacientes });

    const resultado = await servico.solicitarUploadMidia(
      'tenant-1',
      {
        pacienteId: 'paciente-1',
        tipo: 'documento',
        categoria: 'exame',
        nomeArquivo: 'hemograma.pdf',
        mimeType: 'application/pdf',
        tamanhoBytes: 999_999,
        hashConteudo: 'hash-forjado'
      },
      usuarioPaciente
    );

    expect(resultado.uploadUrl).toBe('https://upload.example/assinado');
    expect(resultado.uploadHeaders).toEqual(expect.objectContaining({
      'Content-Type': 'application/pdf',
      'If-None-Match': '*',
      'x-amz-meta-tenantid': 'tenant-1',
      'x-amz-meta-pacienteid': 'paciente-1'
    }));
    expect(repositorios.arquivo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pendente',
        tamanhoBytes: '0',
        hashConteudo: undefined,
        mimeType: 'application/pdf',
        categoria: 'exame'
      })
    );
    expect(criptografia.criptografar).toHaveBeenCalledWith('hemograma.pdf');
    expect(armazenamento.criarUploadAssinado).toHaveBeenCalledWith(
      expect.objectContaining({ mimeType: 'application/pdf', tamanhoMaximoBytes: 999_999 })
    );
  });

  it('vincula anexo a consulta existente do mesmo paciente', async () => {
    const { servico, repositorios, armazenamento } = criarServico({
      pacientes,
      profissionais: [{ id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' }],
      consultas: [{ id: 'consulta-1', tenantId: 'tenant-1', pacienteId: 'paciente-1' }]
    });

    await servico.solicitarUploadMidia(
      'tenant-1',
      {
        pacienteId: 'paciente-1',
        tipo: 'documento',
        mimeType: 'application/pdf',
        tamanhoBytes: 1024,
        vinculoClinico: { tipo: 'consulta', recursoId: 'consulta-1' }
      } as never,
      usuarioProfissional
    );

    expect(repositorios.arquivo.save).toHaveBeenCalledWith(expect.objectContaining({
      metadados: expect.objectContaining({
        vinculoClinico: { tipo: 'consulta', recursoId: 'consulta-1' }
      })
    }));
    expect(armazenamento.criarUploadAssinado).toHaveBeenCalledWith(expect.objectContaining({
      metadados: expect.objectContaining({ vinculoclinicotipo: 'consulta', vinculoclinicoid: 'consulta-1' })
    }));
  });

  it('recusa vinculo clinico que pertence a outro paciente', async () => {
    const { servico, repositorios, armazenamento } = criarServico({
      pacientes,
      profissionais: [{ id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-profissional-1' }],
      consultas: [{ id: 'consulta-2', tenantId: 'tenant-1', pacienteId: 'paciente-2' }]
    });

    await expect(
      servico.solicitarUploadMidia(
        'tenant-1',
        {
          pacienteId: 'paciente-1',
          tipo: 'documento',
          mimeType: 'application/pdf',
          tamanhoBytes: 1024,
          vinculoClinico: { tipo: 'consulta', recursoId: 'consulta-2' }
        } as never,
        usuarioProfissional
      )
    ).rejects.toThrow('Vinculo clinico nao encontrado.');
    expect(repositorios.arquivo.save).not.toHaveBeenCalled();
    expect(armazenamento.criarUploadAssinado).not.toHaveBeenCalled();
  });

  it('impede Patient de criar vinculo clinico no proprio upload', async () => {
    const { servico, repositorios, armazenamento } = criarServico({ pacientes });

    await expect(
      servico.solicitarUploadMidia(
        'tenant-1',
        {
          pacienteId: 'paciente-1',
          tipo: 'documento',
          mimeType: 'application/pdf',
          tamanhoBytes: 1024,
          vinculoClinico: { tipo: 'consulta', recursoId: 'consulta-1' }
        } as never,
        usuarioPaciente
      )
    ).rejects.toThrow('Paciente nao pode vincular anexo a registro clinico.');
    expect(repositorios.arquivo.save).not.toHaveBeenCalled();
    expect(armazenamento.criarUploadAssinado).not.toHaveBeenCalled();
  });

  it('devolve todos os metadados assinados ao formulario publico', async () => {
    const { servico } = criarServico({ pacientes });

    const resultado = await servico.solicitarUploadMidiaFormularioPublico(
      'tenant-1',
      {
        pacienteId: 'paciente-1',
        tipo: 'documento',
        mimeType: 'application/pdf',
        tamanhoBytes: 1024
      },
      { envioid: 'envio-1', perguntaid: 'pergunta-1' }
    );

    expect(resultado.uploadHeaders).toEqual({
      'Content-Type': 'application/pdf',
      'If-None-Match': '*',
      'x-amz-meta-tenantid': 'tenant-1',
      'x-amz-meta-pacienteid': 'paciente-1',
      'x-amz-meta-arquivoid': expect.any(String),
      'x-amz-meta-envioid': 'envio-1',
      'x-amz-meta-perguntaid': 'pergunta-1'
    });
  });

  it('omite escrita condicional do contrato quando o provedor nao a suporta', async () => {
    const { servico } = criarServico({ pacientes }, false);

    const resultado = await servico.solicitarUploadMidia(
      'tenant-1',
      {
        pacienteId: 'paciente-1',
        tipo: 'documento',
        mimeType: 'application/pdf',
        tamanhoBytes: 1024
      },
      usuarioPaciente
    );

    expect(resultado.uploadHeaders).not.toHaveProperty('If-None-Match');
  });

  it('confirma pelo objeto real e ignora tamanho e hash declarados anteriormente', async () => {
    const arquivo = {
      id: 'arquivo-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      tipo: 'documento',
      bucket: 'bucket',
      chaveObjeto: 'tenant-1/paciente-1/documento/arquivo-1',
      mimeType: 'application/pdf',
      tamanhoBytes: '0',
      hashConteudo: undefined,
      status: 'pendente'
    };
    const { servico, repositorios, armazenamento } = criarServico({ pacientes, arquivos: [arquivo] });
    const chavePendente = arquivo.chaveObjeto;

    const confirmado = await servico.confirmarUploadMidia('tenant-1', 'arquivo-1', usuarioPaciente);

    expect(armazenamento.inspecionarObjeto).toHaveBeenCalledWith(
      'bucket',
      chavePendente,
      'documento',
      { arquivoid: 'arquivo-1', pacienteid: 'paciente-1', tenantid: 'tenant-1' }
    );
    expect(armazenamento.promoverObjeto).toHaveBeenCalledWith(
      'bucket',
      chavePendente,
      'confirmados/tenant-1/paciente-1/documento/arquivo-1'
    );
    expect(repositorios.arquivo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        chaveObjeto: 'confirmados/tenant-1/paciente-1/documento/arquivo-1',
        status: 'confirmado',
        tamanhoBytes: '321',
        mimeType: 'application/pdf',
        hashConteudo: 'sha256-real'
      })
    );
    expect(confirmado).toEqual(expect.objectContaining({ status: 'confirmado', tamanhoBytes: '321' }));
  });

  it('impede formulario publico de confirmar anexo de outro paciente', async () => {
    const arquivo = {
      id: 'arquivo-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      tipo: 'documento',
      bucket: 'bucket',
      chaveObjeto: 'tenant-1/paciente-1/documento/arquivo-1',
      status: 'pendente'
    };
    const { servico, armazenamento } = criarServico({ pacientes, arquivos: [arquivo] });

    await expect(
      servico.confirmarUploadMidiaFormularioPublico('tenant-1', 'arquivo-1', 'paciente-2', {
        envioid: 'envio-2',
        perguntaid: 'pergunta-2'
      })
    ).rejects.toThrow('Anexo nao encontrado.');
    expect(armazenamento.inspecionarObjeto).not.toHaveBeenCalled();
  });

  it('exclui o objeto antes de retirar o anexo do prontuario', async () => {
    const arquivo = {
      id: 'arquivo-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      tipo: 'documento',
      bucket: 'bucket',
      chaveObjeto: 'tenant-1/paciente-1/documento/arquivo-1',
      status: 'confirmado'
    };
    const { servico, repositorios, armazenamento } = criarServico({ pacientes, arquivos: [arquivo] });

    await servico.excluirArquivoMidia('tenant-1', 'arquivo-1', usuarioSuperAdmin);

    expect(armazenamento.excluirObjeto).toHaveBeenCalledWith('bucket', arquivo.chaveObjeto);
    expect(repositorios.arquivo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'excluido' }));
  });

  it('impede Patient de excluir anexos incorporados ao prontuario', async () => {
    const { servico, armazenamento } = criarServico({
      pacientes,
      arquivos: [{ id: 'arquivo-1', tenantId: 'tenant-1', pacienteId: 'paciente-1', status: 'confirmado' }]
    });

    await expect(servico.excluirArquivoMidia('tenant-1', 'arquivo-1', usuarioPaciente)).rejects.toThrow(
      'Paciente nao pode excluir anexo do prontuario.'
    );
    expect(armazenamento.excluirObjeto).not.toHaveBeenCalled();
  });

  it('reserva a cota do plano antes de emitir uma URL assinada', async () => {
    const { servico, portalCliente, armazenamento } = criarServico({ pacientes });
    portalCliente.checarLimite.mockResolvedValueOnce({ permitido: true, restante: 1 } as never);

    await expect(
      servico.solicitarUploadMidia(
        'tenant-1',
        { pacienteId: 'paciente-1', tipo: 'documento', mimeType: 'application/pdf', tamanhoBytes: 2 * 1024 * 1024 },
        usuarioPaciente
      )
    ).rejects.toThrow('Limite de armazenamento do plano atingido.');
    expect(armazenamento.criarUploadAssinado).not.toHaveBeenCalled();
  });

  it('remove objeto rejeitado pela inspecao e nao o confirma', async () => {
    const arquivo = {
      id: 'arquivo-1',
      tenantId: 'tenant-1',
      pacienteId: 'paciente-1',
      tipo: 'documento',
      bucket: 'bucket',
      chaveObjeto: 'tenant-1/paciente-1/documento/arquivo-1',
      status: 'pendente'
    };
    const { servico, repositorios, armazenamento } = criarServico({ pacientes, arquivos: [arquivo] });
    armazenamento.inspecionarObjeto.mockRejectedValueOnce(new Error('conteudo invalido'));

    await expect(servico.confirmarUploadMidia('tenant-1', 'arquivo-1', usuarioPaciente)).rejects.toThrow('conteudo invalido');

    expect(armazenamento.excluirObjeto).toHaveBeenCalledWith('bucket', arquivo.chaveObjeto);
    expect(repositorios.arquivo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'excluido' }));
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
