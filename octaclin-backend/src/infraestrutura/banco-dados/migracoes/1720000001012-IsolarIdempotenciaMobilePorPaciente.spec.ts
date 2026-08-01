import { QueryRunner } from 'typeorm';
import { IsolarIdempotenciaMobilePorPaciente1720000001012 } from './1720000001012-IsolarIdempotenciaMobilePorPaciente';

describe('IsolarIdempotenciaMobilePorPaciente1720000001012', () => {
  it('deve vincular sincronizacoes existentes e tornar a chave unica por paciente', async () => {
    const query = jest.fn(async (_sql: string) => undefined);
    await new IsolarIdempotenciaMobilePorPaciente1720000001012().up({ query } as unknown as QueryRunner);

    const sql = query.mock.calls.map(([comando]) => String(comando)).join('\n');
    expect(sql).toContain('ADD COLUMN IF NOT EXISTS paciente_id uuid');
    expect(sql).toContain('SET paciente_id = COALESCE');
    expect(sql).toContain('DROP CONSTRAINT IF EXISTS sincronizacoes_mobile_tenant_id_id_local_key');
    expect(sql).toContain('(tenant_id, paciente_id, id_local)');
  });
});
