import { ConflictException, ForbiddenException } from '@nestjs/common';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { DocumentoEmitidoOrm } from '../infraestrutura/documento-emitido.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { ServicoDocumentosClinicos } from './servico-documentos-clinicos';

const profissional = {
  id: 'profissional-1', tenantId: 'tenant-1', usuarioId: 'usuario-1',
  nomeCriptografado: Buffer.from('Dra. Carla'), registroProfissional: 'CRN-6 1234',
  especialidade: 'Nutrição clínica', arquivadoEm: null
};
const paciente = {
  id: 'paciente-1', tenantId: 'tenant-1', profissionalResponsavelId: profissional.id,
  nomeCriptografado: Buffer.from('Ana Souza'), arquivadoEm: null
};
const profissionalUsuario: UsuarioAutenticado = {
  usuarioId: 'usuario-1', tenantId: 'tenant-1', papel: 'Professional', emailHash: 'hash', permissoes: []
};
const entrada = {
  tipo: 'encaminhamento' as const,
  encaminhamento: { destinoServico: 'Cardiologia', motivoEncaminhamento: 'Avaliação solicitada.' },
  cidadeEmissao: 'Recife'
};

function montarServico() {
  let emitido: Record<string, unknown> | null = null;
  const consulta = { setLock: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), getOne: jest.fn() };
  const repoPaciente = { findOne: jest.fn(async () => paciente), createQueryBuilder: jest.fn(() => ({ ...consulta, getOne: jest.fn(async () => paciente) })) };
  const repoProfissional = {
    findOne: jest.fn(async () => profissional),
    createQueryBuilder: jest.fn(() => ({ ...consulta, getOne: jest.fn(async () => profissional) }))
  };
  const repoDocumento = {
    create: jest.fn((valor: Record<string, unknown>) => valor),
    save: jest.fn(async (valor: Record<string, unknown>) => {
      emitido = { id: 'documento-1', criadoEm: new Date('2026-10-10T12:00:00.000Z'), ...valor };
      return emitido;
    }),
    findOne: jest.fn(async () => emitido)
  };
  const manager = {
    query: jest.fn(async () => undefined),
    getRepository: jest.fn((entidade: unknown) => {
      if (entidade === PacienteOrm) return repoPaciente;
      if (entidade === ProfissionalOrm) return repoProfissional;
      if (entidade === DocumentoEmitidoOrm) return repoDocumento;
      return { findOne: jest.fn(async () => null) };
    })
  };
  const portal = {
    obterConfiguracoes: jest.fn(async () => ({ timezone: 'America/Sao_Paulo', marca: { nomeExibido: 'Clínica' } })),
    obterPerfilEmpresa: jest.fn(async () => ({
      documento: '', nomeLegal: 'Clínica', nomeFantasia: 'Clínica',
      endereco: { cidade: 'Recife', logradouro: '', numero: '', bairro: '', uf: '', cep: '' }
    })),
    obterModelosDocumento: jest.fn(async () => ({ tenantId: 'tenant-1', modelos: [] }))
  };
  const executor = { executar: jest.fn(async (_tenantId: string, acao: (manager: never) => Promise<unknown>) => acao(manager as never)) };
  const crypto = {
    criptografar: jest.fn((valor: string) => Buffer.from(valor)),
    descriptografar: jest.fn((valor: Buffer) => valor.toString())
  };
  const service = new ServicoDocumentosClinicos(executor as never, crypto as never, portal as never, {} as never);
  return { service, repoDocumento, portal, crypto };
}

describe('ServicoDocumentosClinicos - encaminhamento', () => {
  it('gera prévia sem persistir e emite o mesmo snapshot após confirmação', async () => {
    const { service, repoDocumento, crypto } = montarServico();
    const previa = await service.preverEncaminhamento('tenant-1', 'paciente-1', profissionalUsuario, entrada);
    expect(previa.titulo).toBe('Encaminhamento');
    expect(previa.corpo).toContain('Cardiologia');
    expect(previa.corpo).toContain('Avaliação solicitada.');
    expect(previa.cabecalho).not.toHaveProperty('emitidoPor');
    expect(repoDocumento.save).not.toHaveBeenCalled();

    const documento = await service.emitir('tenant-1', 'paciente-1', profissionalUsuario, {
      ...entrada, hashPrevia: previa.hashPrevia,
      chaveEmissao: 'a1111111-1111-4111-8111-111111111111', confirmacao: true
    });
    expect(documento.corpo).toBe(previa.corpo);
    expect(documento.podeEnviarPorEmail).toBe(false);
    expect(crypto.criptografar).toHaveBeenCalledWith(expect.stringContaining('Avaliação solicitada.'));
    expect(repoDocumento.save).toHaveBeenCalledTimes(1);
  });

  it('recusa autor que não seja profissional responsável e conflito de prévia', async () => {
    const { service, portal } = montarServico();
    await expect(service.preverEncaminhamento('tenant-1', 'paciente-1', {
      ...profissionalUsuario, papel: 'Collaborator'
    }, entrada)).rejects.toBeInstanceOf(ForbiddenException);

    const previa = await service.preverEncaminhamento('tenant-1', 'paciente-1', profissionalUsuario, entrada);
    portal.obterModelosDocumento.mockResolvedValue({
      tenantId: 'tenant-1', modelos: [{ tipo: 'encaminhamento', titulo: 'Encaminhamento', corpo: 'Atualizado {{pacienteNome}} {{profissionalNome}} {{profissionalRegistro}} {{dataEmissao}} {{destinoServico}} {{destinatarioNome}} {{instituicaoDestino}} {{motivoEncaminhamento}} {{contextoClinico}}' }]
    } as never);
    await expect(service.emitir('tenant-1', 'paciente-1', profissionalUsuario, {
      ...entrada, hashPrevia: previa.hashPrevia,
      chaveEmissao: 'a1111111-1111-4111-8111-111111111112', confirmacao: true
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('retorna o documento original em retry com a mesma chave e pedido', async () => {
    const { service, repoDocumento } = montarServico();
    const previa = await service.preverEncaminhamento('tenant-1', 'paciente-1', profissionalUsuario, entrada);
    const pedido = {
      ...entrada, hashPrevia: previa.hashPrevia,
      chaveEmissao: 'a1111111-1111-4111-8111-111111111113', confirmacao: true
    };
    await service.emitir('tenant-1', 'paciente-1', profissionalUsuario, pedido);
    await service.emitir('tenant-1', 'paciente-1', profissionalUsuario, pedido);
    expect(repoDocumento.save).toHaveBeenCalledTimes(1);
  });
});
