import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import {
  ehViolacaoUnicidadePostgres,
  resolverTransicaoCicloVidaTenant,
  ServicoCicloVidaTenant
} from './servico-ciclo-vida-tenant';

function criarServicoComSlugVisivelDepoisDaReferencia(provisionamentoReferencia: string) {
  const tenant = {
    id: 'tenant-vencedor',
    nome: 'Clinica concorrente',
    slug: 'clinica-concorrente',
    status: 'ativo',
    cicloVidaStatus: 'ativo_assistido',
    provisionamentoReferencia,
    criadoEm: new Date('2026-09-09T00:00:00.000Z'),
    atualizadoEm: new Date('2026-09-09T00:00:00.000Z')
  };
  const usuario = { id: 'usuario-vencedor', tenantId: tenant.id, role: 'Client' };
  const token = {
    id: 'token-vencedor',
    tenantId: tenant.id,
    usuarioId: usuario.id,
    status: 'pendente',
    expiraEm: new Date('2026-09-16T00:00:00.000Z')
  };
  const repositorioTenants = {
    findOne: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(tenant)
  };
  const gerenciador = {
    getRepository: jest.fn((entidade) => {
      if (entidade.name === 'TenantOrm') return repositorioTenants;
      if (entidade.name === 'UsuarioOrm') return { findOne: jest.fn().mockResolvedValue(usuario) };
      if (entidade.name === 'TokenRedefinicaoSenhaOrm') return { find: jest.fn().mockResolvedValue([token]) };
      throw new Error(`Repositorio inesperado: ${entidade.name}`);
    }),
    query: jest.fn().mockResolvedValue(undefined)
  };
  const fonteDados = {
    transaction: jest.fn(async (acao) => acao(gerenciador))
  };
  const criptografia = { gerarHashBusca: jest.fn().mockReturnValue('hash-email') };
  const servico = new ServicoCicloVidaTenant(fonteDados as never, criptografia as never, {} as never, {} as never);
  Object.defineProperty(servico, 'obterResumo', {
    value: jest.fn().mockResolvedValue({
      ...tenant,
      planoId: 'clinica',
      assinaturaStatus: 'ativa'
    })
  });

  return { servico, repositorioTenants };
}

describe('resolverTransicaoCicloVidaTenant', () => {
  it.each([
    ['ativo_assistido', 'marcar_primeiro_uso', 'primeiro_uso_validado'],
    ['primeiro_uso_validado', 'iniciar_acompanhamento', 'acompanhamento_48h'],
    ['acompanhamento_48h', 'concluir_acompanhamento', 'ativo'],
    ['ativo', 'suspender', 'suspenso'],
    ['suspenso', 'reativar', 'ativo'],
    ['ativo', 'iniciar_encerramento', 'encerramento_pendente']
  ] as const)('deve aplicar %s -> %s -> %s', (atual, acao, esperado) => {
    expect(resolverTransicaoCicloVidaTenant(atual, { acao })).toBe(esperado);
  });

  it('deve exigir exportacao confirmada antes do encerramento definitivo', () => {
    expect(() => resolverTransicaoCicloVidaTenant('encerramento_pendente', { acao: 'encerrar' })).toThrow(
      BadRequestException
    );
    expect(
      resolverTransicaoCicloVidaTenant('encerramento_pendente', {
        acao: 'encerrar',
        exportacaoConfirmada: true,
        protocoloExportacao: 'EXP-2026-001'
      })
    ).toBe('encerrado');
  });

  it('deve exigir protocolo rastreavel da exportacao', () => {
    expect(() =>
      resolverTransicaoCicloVidaTenant('encerramento_pendente', {
        acao: 'encerrar',
        exportacaoConfirmada: true
      })
    ).toThrow(BadRequestException);
  });

  it('deve rejeitar saltos de etapa e reabertura de tenant encerrado', () => {
    expect(() => resolverTransicaoCicloVidaTenant('ativo_assistido', { acao: 'concluir_acompanhamento' })).toThrow(
      ConflictException
    );
    expect(() => resolverTransicaoCicloVidaTenant('encerrado', { acao: 'reativar' })).toThrow(ConflictException);
  });

  it('deve ser idempotente quando o estado de destino ja foi atingido', () => {
    expect(resolverTransicaoCicloVidaTenant('suspenso', { acao: 'suspender' })).toBe('suspenso');
  });
});

describe('ehViolacaoUnicidadePostgres', () => {
  it('deve reconhecer somente o codigo 23505 do driver Postgres', () => {
    const duplicidade = new QueryFailedError('insert', [], Object.assign(new Error('duplicate'), { code: '23505' }));
    const outroErro = new QueryFailedError('insert', [], Object.assign(new Error('fk'), { code: '23503' }));
    expect(ehViolacaoUnicidadePostgres(duplicidade)).toBe(true);
    expect(ehViolacaoUnicidadePostgres(outroErro)).toBe(false);
    expect(ehViolacaoUnicidadePostgres(new Error('fora do driver'))).toBe(false);
  });
});

describe('ServicoCicloVidaTenant.provisionar', () => {
  const dados = {
    referencia: 'fase228-corrida',
    nome: 'Clinica concorrente',
    slug: 'clinica-concorrente',
    emailProprietario: 'owner.concorrente@octaclin.test',
    planoId: 'clinica' as const,
    timezone: 'America/Sao_Paulo'
  };

  it('reutiliza o vencedor quando o slug da mesma referencia fica visivel entre as duas consultas', async () => {
    const { servico, repositorioTenants } = criarServicoComSlugVisivelDepoisDaReferencia('fase228-corrida');

    await expect(servico.provisionar(dados, 'operador-1')).resolves.toMatchObject({
      id: 'tenant-vencedor',
      reutilizado: true
    });
    expect(repositorioTenants.findOne).toHaveBeenNthCalledWith(1, {
      where: { provisionamentoReferencia: 'fase228-corrida' }
    });
    expect(repositorioTenants.findOne).toHaveBeenNthCalledWith(2, { where: { slug: 'clinica-concorrente' } });
  });

  it('mantem conflito quando o slug pertence a outra referencia', async () => {
    const { servico } = criarServicoComSlugVisivelDepoisDaReferencia('outra-referencia');

    await expect(servico.provisionar(dados, 'operador-1')).rejects.toThrow('Ja existe tenant com este slug.');
  });
});
