import { BadRequestException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { ServicoRevisaoCheckins } from './servico-revisao-checkins';
import { LogDiarioRapidoOrm } from '../../mobile/infraestrutura/log-diario-rapido.orm';
import { PacienteOrm } from '../infraestrutura/paciente.orm';
import type { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';

jest.mock('../../auth/infraestrutura/configuracao-jwt', () => ({ obterSegredoAcesso: () => 'segredo-sintetico-de-teste-com-trinta-e-dois-bytes' }));
jest.mock('../../../infraestrutura/seguranca/escopo-profissional', () => ({ resolverProfissionalIdDoUsuario: jest.fn().mockResolvedValue('profissional-a') }));

const usuario: UsuarioAutenticado = {
  usuarioId: 'usuario-a', tenantId: 'tenant-a', papel: 'Professional', emailHash: 'hash-sintetico',
  permissoes: ['pacientes.ler', 'pacientes.gerenciar'], sessaoId: 'sessao-a'
};

function cenario() {
  const paciente = { id: 'paciente-a', tenantId: 'tenant-a', profissionalResponsavelId: 'profissional-a', statusCicloVida: 'ACTIVE', nomeCriptografado: Buffer.from('nome') };
  const diario: { id: string; tenantId: string; pacienteId: string; tipo: string; registradoEm: Date; valorCriptografado: Buffer; revisadoEm?: Date; revisadoPorUsuarioId?: string } = { id: 'diario-a', tenantId: 'tenant-a', pacienteId: paciente.id, tipo: 'humor', registradoEm: new Date('2026-09-30T12:00:00Z'), valorCriptografado: Buffer.from('valor') };
  const repositorioDiario = {
    findOne: jest.fn(async () => diario),
    update: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn()
  };
  const repositorioPaciente = { findOne: jest.fn(async () => paciente.statusCicloVida === 'ACTIVE' ? paciente : null), find: jest.fn(async () => [paciente]) };
  const consulta = { innerJoin: jest.fn(), where: jest.fn(), andWhere: jest.fn(), orderBy: jest.fn(), addOrderBy: jest.fn(), skip: jest.fn(), take: jest.fn(), getManyAndCount: jest.fn(async () => [[diario], 1]) };
  for (const metodo of ['innerJoin', 'where', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take'] as const) consulta[metodo].mockReturnValue(consulta);
  repositorioDiario.createQueryBuilder.mockReturnValue(consulta);
  const gerenciador = { getRepository: jest.fn((entidade) => entidade === LogDiarioRapidoOrm ? repositorioDiario : entidade === PacienteOrm ? repositorioPaciente : undefined) };
  const executor = { executar: jest.fn(async (_tenant, fn) => fn(gerenciador)) };
  const cripto = { descriptografar: jest.fn((valor: Buffer) => valor === diario.valorCriptografado ? JSON.stringify({ humor: 'bem', adesaoPlano: 75, sintomas: 'Exemplo sintético' }) : 'Paciente sintético') };
  const servico = new ServicoRevisaoCheckins(executor as never, cripto as never);
  return { servico, diario, paciente, repositorioDiario, repositorioPaciente, consulta, executor, cripto };
}

describe('ServicoRevisaoCheckins', () => {
  it('pagina apenas registros pendentes do profissional e tenant', async () => {
    const { servico, consulta, executor } = cenario();
    const resultado = await servico.listarPendentes('tenant-a', usuario, 2);
    expect(resultado).toEqual(expect.objectContaining({ pagina: 2, tamanho: 20, total: 1 }));
    expect(resultado.itens[0]).toEqual(expect.objectContaining({ id: 'diario-a', pacienteNome: 'Paciente sintético' }));
    expect(consulta.where).toHaveBeenCalledWith('diario.tenantId = :tenantId', { tenantId: 'tenant-a' });
    expect(consulta.andWhere).toHaveBeenCalledWith('paciente.profissionalResponsavelId = :profissionalId', { profissionalId: 'profissional-a' });
    expect(consulta.skip).toHaveBeenCalledWith(20);
    expect(executor.executar).toHaveBeenCalledWith('tenant-a', expect.any(Function));
  });

  it('abre o conteúdo de um registro autorizado e emite comprovante de leitura', async () => {
    const { servico } = cenario();
    const detalhe = await servico.obterDetalhe('tenant-a', 'diario-a', usuario);
    expect(detalhe).toEqual(expect.objectContaining({ pacienteId: 'paciente-a', humor: 'bem', adesaoPlano: 75, sintomas: 'Exemplo sintético' }));
    expect(detalhe.comprovanteLeitura).toBeTruthy();
  });

  it('não emite comprovante para conteúdo clínico ilegível', async () => {
    const { servico, diario, cripto } = cenario();
    cripto.descriptografar.mockImplementation((valor: Buffer) => valor === diario.valorCriptografado
      ? '{conteudo ilegivel' : 'Paciente sintético');
    await expect(servico.obterDetalhe('tenant-a', diario.id, usuario)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('bloqueia o registro de outro tenant ou profissional', async () => {
    const { servico, repositorioPaciente, repositorioDiario } = cenario();
    repositorioDiario.findOne.mockResolvedValueOnce(null as never);
    await expect(servico.obterDetalhe('tenant-b', 'diario-a', { ...usuario, tenantId: 'tenant-b' })).rejects.toBeInstanceOf(NotFoundException);
    expect(repositorioDiario.findOne).toHaveBeenCalledWith({ where: { id: 'diario-a', tenantId: 'tenant-b' } });
    repositorioPaciente.findOne.mockResolvedValueOnce(null as never);
    await expect(servico.obterDetalhe('tenant-a', 'diario-a', usuario)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('só confirma com recibo da mesma sessão e grava uma única revisão', async () => {
    const { servico, repositorioDiario } = cenario();
    const detalhe = await servico.obterDetalhe('tenant-a', 'diario-a', usuario);
    await expect(servico.revisar('tenant-a', 'diario-a', usuario, '')).rejects.toBeInstanceOf(BadRequestException);
    await expect(servico.revisar('tenant-a', 'diario-a', { ...usuario, sessaoId: 'outra-sessao' }, detalhe.comprovanteLeitura!)).rejects.toBeInstanceOf(BadRequestException);
    const resultado = await servico.revisar('tenant-a', 'diario-a', usuario, detalhe.comprovanteLeitura!);
    expect(resultado).toEqual(expect.objectContaining({ id: 'diario-a', revisadoEm: expect.any(Date), revisadoPorUsuarioId: usuario.usuarioId }));
    expect(repositorioDiario.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'diario-a', tenantId: 'tenant-a' }),
      expect.objectContaining({ revisadoPorUsuarioId: usuario.usuarioId })
    );
  });

  it('não altera um registro já revisado ou de paciente arquivado', async () => {
    const { servico, diario, paciente, repositorioDiario } = cenario();
    const detalhe = await servico.obterDetalhe('tenant-a', 'diario-a', usuario);
    diario.revisadoEm = new Date('2026-09-30T13:00:00Z');
    expect((await servico.revisar('tenant-a', 'diario-a', usuario, detalhe.comprovanteLeitura!)).revisadoEm).toEqual(diario.revisadoEm);
    expect(repositorioDiario.update).not.toHaveBeenCalled();
    delete diario.revisadoEm;
    paciente.statusCicloVida = 'ARCHIVED';
    await expect(servico.obterDetalhe('tenant-a', 'diario-a', usuario)).rejects.toBeInstanceOf(NotFoundException);
  });
});
