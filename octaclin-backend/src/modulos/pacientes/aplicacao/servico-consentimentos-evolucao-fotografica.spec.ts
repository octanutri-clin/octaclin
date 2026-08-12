import { BadRequestException } from '@nestjs/common';
import { ConsentimentoEvolucaoFotograficaOrm } from '../infraestrutura/consentimento-evolucao-fotografica.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import { ServicoConsentimentosEvolucaoFotografica } from './servico-consentimentos-evolucao-fotografica';

describe('ServicoConsentimentosEvolucaoFotografica', () => {
  const usuario = { tenantId: 'tenant-1', usuarioId: 'usuario-1', papel: 'SuperAdmin', permissoes: ['pacientes.ler', 'pacientes.gerenciar'] } as never;

  function criarServico() {
    const dados: any[] = [];
    const repositorioConsentimentos = {
      create: jest.fn((entrada: Record<string, unknown>) => entrada),
      save: jest.fn(async (entrada: Record<string, any>) => {
        const salvo = { id: entrada.id ?? `consentimento-${dados.length + 1}`, criadoEm: new Date(), ...entrada };
        const indice = dados.findIndex((item) => item.id === salvo.id);
        if (indice >= 0) dados[indice] = salvo;
        else dados.push(salvo);
        return salvo;
      }),
      find: jest.fn(async () => [...dados]),
      findOne: jest.fn(async ({ where }: { where: Record<string, unknown> }) => dados.find((item) =>
        item.id === where.id && item.tenantId === where.tenantId && item.pacienteId === where.pacienteId && !item.revogadoEm
      ))
    };
    const gerenciador = {
      getRepository: jest.fn((entidade: unknown) => {
        if (entidade === PacienteOrm) return { findOne: jest.fn(async () => ({ id: 'paciente-1' })) };
        if (entidade === ConsentimentoEvolucaoFotograficaOrm) return repositorioConsentimentos;
        throw new Error('Repositorio nao mapeado');
      })
    };
    const criptografia = { criptografar: jest.fn((valor: string) => Buffer.from(`cifrado:${valor}`)) };
    const servico = new ServicoConsentimentosEvolucaoFotografica(
      { executar: async (_: string, fn: (arg: unknown) => unknown) => fn(gerenciador) } as never,
      criptografia as never
    );
    return { servico, repositorioConsentimentos, criptografia };
  }

  it('cifra evidencia, expoe somente metadados e permite revogacao logica', async () => {
    const { servico, repositorioConsentimentos, criptografia } = criarServico();
    const criado = await servico.registrar('tenant-1', 'paciente-1', {
      versao: 'foto-v1', retencaoAte: '2030-01-01', evidencia: 'Aceite presencial sintetico'
    }, usuario);

    expect(criptografia.criptografar).toHaveBeenCalledWith('Aceite presencial sintetico');
    expect(criado).toEqual(expect.objectContaining({ versao: 'foto-v1', ativo: true }));
    expect(criado).not.toHaveProperty('evidencia');

    const revogado = await servico.revogar('tenant-1', 'paciente-1', criado.id, usuario);
    expect(revogado).toEqual(expect.objectContaining({ id: criado.id, ativo: false, revogadoEm: expect.any(String) }));
    expect(repositorioConsentimentos.save).toHaveBeenCalledTimes(2);
  });

  it('recusa prazo de retencao no passado antes de acessar o banco', async () => {
    const { servico, repositorioConsentimentos } = criarServico();
    await expect(servico.registrar('tenant-1', 'paciente-1', {
      versao: 'foto-v1', retencaoAte: '2000-01-01'
    }, usuario)).rejects.toBeInstanceOf(BadRequestException);
    expect(repositorioConsentimentos.save).not.toHaveBeenCalled();
  });
});
