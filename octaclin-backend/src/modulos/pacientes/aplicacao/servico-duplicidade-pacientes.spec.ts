import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoDuplicidadePacientes } from './servico-duplicidade-pacientes';

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const USUARIO_ID = '10000000-0000-4000-8000-000000000002';
const PROFISSIONAL_ID = '10000000-0000-4000-8000-000000000003';

const criptografia = new CriptografiaDadosSensiveis();

function profissional(): UsuarioAutenticado {
  return {
    usuarioId: USUARIO_ID, tenantId: TENANT_ID, papel: 'Professional',
    emailHash: 'hash', permissoes: ['pacientes.listar', 'pacientes.ler', 'pacientes.gerenciar']
  };
}

function pacienteSintetico(id: string, nome: string, nascimento?: string, contato?: string) {
  return {
    id,
    tenantId: TENANT_ID,
    profissionalResponsavelId: PROFISSIONAL_ID,
    nomeCriptografado: criptografia.criptografar(nome),
    contatoCriptografado: contato ? criptografia.criptografar(JSON.stringify({ email: contato })) : undefined,
    dataNascimento: nascimento,
    buscaHashes: criptografia.gerarHashesBuscaPii(TENANT_ID, [nome, contato]),
    arquivadoEm: null
  };
}

function montarCom(registros: any[]) {
  const consultasFeitas: any[] = [];
  const pacientes = {
    find: jest.fn(async (opcoes: any) => {
      consultasFeitas.push(opcoes);
      return [...registros];
    })
  };
  const profissionais = {
    findOne: jest.fn(async () => ({
      id: PROFISSIONAL_ID, tenantId: TENANT_ID, usuarioId: USUARIO_ID, arquivadoEm: null
    }))
  };
  const gerenciador = {
    getRepository: (entidade: any) => (entidade.name === 'ProfissionalOrm' ? profissionais : pacientes)
  };
  const executorTenant = {
    executar: async (_tenantId: string, operacao: any) => operacao(gerenciador)
  } as unknown as ExecutorTenant;
  const auditoria = { registrar: jest.fn(async (_entrada: any) => undefined) };

  return {
    servico: new ServicoDuplicidadePacientes(executorTenant, criptografia, auditoria as never),
    consultasFeitas,
    gerenciador,
    auditoria
  };
}

describe('ServicoDuplicidadePacientes.verificar', () => {
  it('aponta nome_e_nascimento quando os dois batem', async () => {
    const { servico } = montarCom([pacienteSintetico('p1', 'Maria Silva', '1990-03-04')]);
    const { candidatos } = await servico.verificar(TENANT_ID, profissional(), {
      nome: 'Maria Silva', dataNascimento: '1990-03-04'
    });
    expect(candidatos).toHaveLength(1);
    expect(candidatos[0].motivos).toContain('nome_e_nascimento');
    expect(candidatos[0].pacienteId).toBe('p1');
  });

  it('aponta nome sozinho quando nao ha nascimento dos dois lados', async () => {
    const { servico } = montarCom([pacienteSintetico('p1', 'Maria Silva')]);
    const { candidatos } = await servico.verificar(TENANT_ID, profissional(), { nome: 'Maria Silva' });
    expect(candidatos[0].motivos).toEqual(['nome']);
  });

  it('nao aponta nome sozinho quando ha nascimento diferente', async () => {
    const { servico } = montarCom([pacienteSintetico('p1', 'Maria Silva', '1990-03-04')]);
    const { candidatos } = await servico.verificar(TENANT_ID, profissional(), {
      nome: 'Maria Silva', dataNascimento: '1985-01-01'
    });
    expect(candidatos).toHaveLength(0);
  });

  it('aponta contato mesmo com nome diferente', async () => {
    const { servico } = montarCom([pacienteSintetico('p1', 'Maria Silva', undefined, 'maria@exemplo.test')]);
    const { candidatos } = await servico.verificar(TENANT_ID, profissional(), {
      nome: 'Maria Souza', contato: 'maria@exemplo.test'
    });
    expect(candidatos[0].motivos).toContain('contato');
  });

  it('nao busca fora da carteira do profissional', async () => {
    const { servico, consultasFeitas } = montarCom([]);
    await servico.verificar(TENANT_ID, profissional(), { nome: 'Maria Silva' });
    expect(consultasFeitas[0].where.profissionalResponsavelId).toBe(PROFISSIONAL_ID);
  });

  it('devolve no maximo 5 candidatos', async () => {
    const registros = Array.from({ length: 9 }, (_, indice) =>
      pacienteSintetico(`p${indice}`, 'Maria Silva'));
    const { servico } = montarCom(registros);
    const { candidatos } = await servico.verificar(TENANT_ID, profissional(), { nome: 'Maria Silva' });
    expect(candidatos).toHaveLength(5);
  });

  it('nao devolve o proprio paciente na entrada por paciente salvo', async () => {
    const atual = pacienteSintetico('p1', 'Maria Silva', '1990-03-04');
    const { servico, gerenciador } = montarCom([atual]);
    const candidatos = await servico.verificarPorPaciente(gerenciador as never, TENANT_ID, profissional(), atual as never);
    expect(candidatos).toHaveLength(0);
  });
});

describe('ServicoDuplicidadePacientes.registrarDispensa', () => {
  it('grava apenas UUID na auditoria, nunca nome', async () => {
    const { servico, auditoria } = montarCom([]);
    await servico.registrarDispensa(TENANT_ID, profissional(), 'paciente-novo', ['candidato-1']);
    const entrada = auditoria.registrar.mock.calls[0][0];
    expect(entrada.acao).toBe('paciente.duplicidade_dispensada');
    expect(entrada.metadados).toEqual({ candidatosDispensados: ['candidato-1'] });
  });
});
