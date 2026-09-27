import { BadRequestException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { UsuarioOrm } from '../../usuarios/infraestrutura/usuario.orm';
import { AcompanhamentoTarefaOrm } from '../infraestrutura/acompanhamento-tarefa.orm';
import {
  cancelarTarefaRevisaoPerfil, criarTarefaRevisaoPerfil, dataCivilRevisaoValida,
  idTarefaRevisaoPerfil, lerDataRevisaoPerfilEstrita, reatribuirTarefaRevisaoPerfil,
  vencimentoRevisaoPerfil
} from './tarefa-revisao-perfil';

const tenantId = '11111111-1111-1111-1111-111111111111';
const pacienteId = '22222222-2222-2222-2222-222222222222';
const profissionalId = '33333333-3333-3333-3333-333333333333';
const usuarioId = '44444444-4444-4444-4444-444444444444';
const criptografia = {
  criptografar: jest.fn((valor: string) => Buffer.from(valor)),
  descriptografar: jest.fn((valor: Buffer) => valor.toString())
};

function cenario(tarefaExistente?: Partial<AcompanhamentoTarefaOrm>, destinoAtivo = true) {
  const execute = jest.fn(async () => ({}));
  const orIgnore = jest.fn(() => ({ execute }));
  const values = jest.fn(() => ({ orIgnore }));
  const into = jest.fn(() => ({ values }));
  const insert = jest.fn(() => ({ into }));
  const tarefas = {
    findOne: jest.fn(async () => tarefaExistente ?? null),
    createQueryBuilder: jest.fn(() => ({ insert })),
    update: jest.fn(async () => ({ affected: 1 }))
  };
  const profissionais = { findOne: jest.fn(async ({ where }) => where.tenantId === tenantId ? { id: profissionalId, usuarioId } : null) };
  const usuarios = { findOne: jest.fn(async ({ where }) => destinoAtivo && where.tenantId === tenantId ? { id: usuarioId } : null) };
  const gerenciador = { getRepository: jest.fn((entidade: unknown) => {
    if (entidade === AcompanhamentoTarefaOrm) return tarefas;
    if (entidade === ProfissionalOrm) return profissionais;
    if (entidade === UsuarioOrm) return usuarios;
    throw new Error('Repositorio inesperado.');
  }) } as unknown as EntityManager;
  return { gerenciador, tarefas, profissionais, usuarios, values, execute };
}

describe('tarefa de revisao do perfil', () => {
  it('usa data civil valida e vence no fim do dia no fuso clinico', () => {
    const anterior = process.env.GOOGLE_CALENDAR_TIMEZONE;
    try {
      process.env.GOOGLE_CALENDAR_TIMEZONE = 'America/Sao_Paulo';
      expect(dataCivilRevisaoValida('2028-02-29')).toBe(true);
      expect(dataCivilRevisaoValida('2027-02-29')).toBe(false);
      expect(dataCivilRevisaoValida('2026-01-01T00:00:00Z')).toBe(false);
      expect(vencimentoRevisaoPerfil('2026-09-27').toISOString()).toBe('2026-09-28T02:59:59.000Z');
      process.env.GOOGLE_CALENDAR_TIMEZONE = 'America/New_York';
      expect(vencimentoRevisaoPerfil('2026-11-01').toISOString()).toBe('2026-11-02T04:59:59.000Z');
      expect(() => vencimentoRevisaoPerfil('2026-02-31')).toThrow(BadRequestException);
    } finally {
      if (anterior === undefined) delete process.env.GOOGLE_CALENDAR_TIMEZONE;
      else process.env.GOOGLE_CALENDAR_TIMEZONE = anterior;
    }
  });

  it('separa identidade por tenant, paciente e data e falha fechado no backfill', () => {
    expect(idTarefaRevisaoPerfil(tenantId, pacienteId, '2026-10-01'))
      .toBe(idTarefaRevisaoPerfil(tenantId, pacienteId, '2026-10-01'));
    expect(idTarefaRevisaoPerfil(tenantId, pacienteId, '2026-10-01'))
      .not.toBe(idTarefaRevisaoPerfil('55555555-5555-5555-5555-555555555555', pacienteId, '2026-10-01'));
    expect(idTarefaRevisaoPerfil(tenantId, pacienteId, '2026-10-01'))
      .not.toBe(idTarefaRevisaoPerfil(tenantId, pacienteId, '2026-10-02'));
    expect(lerDataRevisaoPerfilEstrita(criptografia as never, Buffer.from('{"proximaRevisaoEm":"2026-10-01"}')))
      .toBe('2026-10-01');
    expect(() => lerDataRevisaoPerfilEstrita(criptografia as never, Buffer.from('{"proximaRevisaoEm":"2026-02-31"}')))
      .toThrow('Bloco de operacao invalido');
  });

  it('cria uma unica tarefa cifrada para o usuario ativo do profissional responsavel', async () => {
    const c = cenario();
    await criarTarefaRevisaoPerfil(c.gerenciador, criptografia as never, tenantId, pacienteId, profissionalId, '2026-10-01');
    expect(c.values).toHaveBeenCalledWith(expect.objectContaining({
      id: idTarefaRevisaoPerfil(tenantId, pacienteId, '2026-10-01'),
      tenantId, pacienteId, profissionalId: usuarioId, status: 'pendente', tituloCriptografado: expect.any(Buffer)
    }));
    expect(c.execute).toHaveBeenCalledTimes(1);
    const existente = cenario({ id: idTarefaRevisaoPerfil(tenantId, pacienteId, '2026-10-01'), status: 'concluida' });
    await criarTarefaRevisaoPerfil(existente.gerenciador, criptografia as never, tenantId, pacienteId, profissionalId, '2026-10-01');
    expect(existente.execute).not.toHaveBeenCalled();
  });

  it('nao grava se o destino do tenant esta indisponivel', async () => {
    const c = cenario(undefined, false);
    await expect(criarTarefaRevisaoPerfil(c.gerenciador, criptografia as never, tenantId, pacienteId, profissionalId, '2026-10-01'))
      .rejects.toThrow(BadRequestException);
    expect(c.execute).not.toHaveBeenCalled();
    expect(c.usuarios.findOne).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenantId, ativo: true }) }));
  });

  it('cancela apenas estados abertos e transfere apenas tarefa aberta', async () => {
    const c = cenario({ id: idTarefaRevisaoPerfil(tenantId, pacienteId, '2026-10-01'), status: 'pendente' });
    await cancelarTarefaRevisaoPerfil(c.gerenciador, tenantId, pacienteId, '2026-10-01');
    expect(c.tarefas.update).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, pacienteId, status: 'pendente' }), { status: 'cancelada' }
    );
    expect(c.tarefas.update).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, pacienteId, status: 'em_andamento' }), { status: 'cancelada' }
    );
    await reatribuirTarefaRevisaoPerfil(c.gerenciador, tenantId, pacienteId, '2026-10-01', profissionalId);
    expect(c.tarefas.update).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId, pacienteId, status: 'pendente' }), { profissionalId: usuarioId }
    );
    const concluida = cenario({ id: 'tarefa', status: 'concluida' });
    await reatribuirTarefaRevisaoPerfil(concluida.gerenciador, tenantId, pacienteId, '2026-10-01', profissionalId);
    expect(concluida.tarefas.update).not.toHaveBeenCalled();
  });
});
