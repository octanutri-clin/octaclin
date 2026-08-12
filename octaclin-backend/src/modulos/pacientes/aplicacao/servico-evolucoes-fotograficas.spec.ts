import { BadRequestException } from '@nestjs/common';
import { ConsentimentoEvolucaoFotograficaOrm } from '../infraestrutura/consentimento-evolucao-fotografica.orm';
import { EvolucaoFotograficaOrm } from '../infraestrutura/evolucao-fotografica.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { ServicoEvolucoesFotograficas } from './servico-evolucoes-fotograficas';

describe('ServicoEvolucoesFotograficas', () => {
  const usuario = { tenantId: 'tenant-1', usuarioId: 'usuario-1', papel: 'SuperAdmin', permissoes: ['pacientes.gerenciar'] } as never;

  function criarServico(retencaoAte = '2030-01-01', revogadoEm?: Date) {
    const evolucoes: Record<string, unknown>[] = [];
    const repositorioEvolucoes = {
      create: jest.fn((dados: Record<string, unknown>) => ({ id: 'evolucao-1', ...dados })),
      save: jest.fn(async (dados: Record<string, unknown>) => { evolucoes.push(dados); return dados; }),
      findOne: jest.fn(async () => null)
    };
    const gerenciador = {
      getRepository: jest.fn((entidade: unknown) => {
        if (entidade === PacienteOrm) return { findOne: jest.fn(async () => ({ id: 'paciente-1' })) };
        if (entidade === ConsentimentoEvolucaoFotograficaOrm) return { findOne: jest.fn(async () => revogadoEm ? null : ({ id: 'consentimento-1', retencaoAte })) };
        if (entidade === EvolucaoFotograficaOrm) return repositorioEvolucoes;
        throw new Error('Repositorio nao mapeado');
      })
    };
    const servicoMobile = { solicitarUploadMidia: jest.fn(async () => ({ arquivo: { id: 'arquivo-1' }, uploadUrl: 'https://upload.example' })) };
    const servico = new ServicoEvolucoesFotograficas(
      { executar: async (_: string, fn: (gerenciador: unknown) => unknown) => fn(gerenciador) } as never,
      { criptografar: jest.fn((valor: string) => Buffer.from(`cifrado:${valor}`)) } as never,
      servicoMobile as never
    );
    return { servico, servicoMobile, repositorioEvolucoes, evolucoes };
  }

  it('cria serie cifrada e solicita imagem privada vinculada ao consentimento ativo', async () => {
    const { servico, servicoMobile, repositorioEvolucoes } = criarServico();
    const resultado = await servico.solicitarUpload('tenant-1', 'paciente-1', {
      consentimentoId: 'consentimento-1', protocolo: 'Frente', capturadaEm: '2026-08-12', mimeType: 'image/jpeg', tamanhoBytes: 1024, nomeArquivo: 'foto.jpg'
    }, usuario);
    expect(resultado.evolucaoId).toBe('evolucao-1');
    expect(repositorioEvolucoes.save).toHaveBeenCalledWith(expect.objectContaining({ consentimentoId: 'consentimento-1', protocoloCriptografado: expect.any(Buffer) }));
    expect(servicoMobile.solicitarUploadMidia).toHaveBeenCalledWith('tenant-1', expect.objectContaining({
      pacienteId: 'paciente-1', tipo: 'imagem', categoria: 'foto', vinculoClinico: { tipo: 'evolucao_fotografica', recursoId: 'evolucao-1' }
    }), usuario);
  });

  it('recusa criar serie quando o consentimento nao esta ativo', async () => {
    const { servico, servicoMobile } = criarServico('2030-01-01', new Date());
    await expect(servico.solicitarUpload('tenant-1', 'paciente-1', {
      consentimentoId: 'consentimento-1', protocolo: 'Frente', capturadaEm: '2026-08-12', mimeType: 'image/jpeg', tamanhoBytes: 1024
    }, usuario)).rejects.toBeInstanceOf(BadRequestException);
    expect(servicoMobile.solicitarUploadMidia).not.toHaveBeenCalled();
  });
});
