import { BadRequestException } from '@nestjs/common';
import { ConsentimentoEvolucaoFotograficaOrm } from '../infraestrutura/consentimento-evolucao-fotografica.orm';
import { EvolucaoFotograficaArquivoOrm } from '../infraestrutura/evolucao-fotografica-arquivo.orm';
import { EvolucaoFotograficaOrm } from '../infraestrutura/evolucao-fotografica.orm';
import { ArquivoMidiaOrm } from '../../mobile/infraestrutura/arquivo-midia.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { ServicoEvolucoesFotograficas } from './servico-evolucoes-fotograficas';

describe('ServicoEvolucoesFotograficas', () => {
  const usuario = { tenantId: 'tenant-1', usuarioId: 'usuario-1', papel: 'SuperAdmin', permissoes: ['pacientes.gerenciar'] } as never;

  function criarServico(retencaoAte = '2030-01-01', revogadoEm?: Date) {
    const evolucoes: Record<string, unknown>[] = [];
    const repositorioEvolucoes = {
      create: jest.fn((dados: Record<string, unknown>) => ({ id: 'evolucao-1', ...dados })),
      save: jest.fn(async (dados: Record<string, unknown>) => { evolucoes.push(dados); return dados; }),
      findOne: jest.fn(async () => null),
      delete: jest.fn(async () => undefined)
    };
    const repositorioVinculos = {
      find: jest.fn(async () => [{ arquivoMidiaId: 'arquivo-1' }]),
      delete: jest.fn(async () => undefined)
    };
    const repositorioArquivos = {
      find: jest.fn(async () => [{ id: 'arquivo-1', bucket: 'privado', chaveObjeto: 'tenant-1/foto.jpg', categoria: 'foto' }]),
      delete: jest.fn(async () => undefined)
    };
    const gerenciador = {
      getRepository: jest.fn((entidade: unknown) => {
        if (entidade === PacienteOrm) return { findOne: jest.fn(async () => ({ id: 'paciente-1' })) };
        if (entidade === ConsentimentoEvolucaoFotograficaOrm) return { findOne: jest.fn(async () => revogadoEm ? null : ({ id: 'consentimento-1', retencaoAte })) };
        if (entidade === EvolucaoFotograficaOrm) return repositorioEvolucoes;
        if (entidade === EvolucaoFotograficaArquivoOrm) return repositorioVinculos;
        if (entidade === ArquivoMidiaOrm) return repositorioArquivos;
        throw new Error('Repositorio nao mapeado');
      })
    };
    const servicoMobile = { solicitarUploadMidia: jest.fn(async () => ({ arquivo: { id: 'arquivo-1' }, uploadUrl: 'https://upload.example' })) };
    const armazenamento = { excluirObjetoVerificado: jest.fn(async () => undefined) };
    const servico = new ServicoEvolucoesFotograficas(
      { executar: async (_: string, fn: (gerenciador: unknown) => unknown) => fn(gerenciador) } as never,
      { criptografar: jest.fn((valor: string) => Buffer.from(`cifrado:${valor}`)) } as never,
      servicoMobile as never,
      armazenamento as never
    );
    return { servico, servicoMobile, armazenamento, repositorioEvolucoes, repositorioVinculos, repositorioArquivos, evolucoes };
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

  it('remove objeto privado, vinculo e serie fotografica', async () => {
    const { servico, armazenamento, repositorioEvolucoes, repositorioVinculos, repositorioArquivos } = criarServico();
    (repositorioEvolucoes.findOne as jest.Mock).mockResolvedValue({ id: 'evolucao-1' });

    await expect(servico.excluir('tenant-1', 'paciente-1', 'evolucao-1', usuario)).resolves.toEqual({ arquivosRemovidos: 1 });

    expect(armazenamento.excluirObjetoVerificado).toHaveBeenCalledWith('privado', 'tenant-1/foto.jpg');
    expect(repositorioVinculos.delete).toHaveBeenCalledWith({ tenantId: 'tenant-1', evolucaoFotograficaId: 'evolucao-1' });
    expect(repositorioArquivos.delete).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', pacienteId: 'paciente-1' }));
    expect(repositorioEvolucoes.delete).toHaveBeenCalledWith({ id: 'evolucao-1', tenantId: 'tenant-1', pacienteId: 'paciente-1' });
  });

  it('nao apaga os registros da serie quando a exclusao fisica do objeto nao pode ser confirmada', async () => {
    const { servico, armazenamento, repositorioEvolucoes, repositorioVinculos, repositorioArquivos } = criarServico();
    (repositorioEvolucoes.findOne as jest.Mock).mockResolvedValue({ id: 'evolucao-1' });
    (armazenamento.excluirObjetoVerificado as jest.Mock).mockRejectedValue(new Error('Exclusao fisica do objeto nao pode ser confirmada.'));

    await expect(servico.excluir('tenant-1', 'paciente-1', 'evolucao-1', usuario)).rejects.toThrow(
      'Exclusao fisica do objeto nao pode ser confirmada.'
    );

    expect(repositorioVinculos.delete).not.toHaveBeenCalled();
    expect(repositorioArquivos.delete).not.toHaveBeenCalled();
    expect(repositorioEvolucoes.delete).not.toHaveBeenCalled();
  });
});
