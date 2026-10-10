import { BadRequestException, ConflictException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { MaterialEducativoOrm } from '../../materiais/infraestrutura/material-educativo.orm';
import { TenantConfiguracaoOrm } from '../infraestrutura/tenant-configuracao.orm';
import { CHAVE_KIT_INICIAL_CLINICA, VERSAO_KIT_INICIAL_CLINICA } from '../kit-inicial-clinica';
import { instalarKitInicialClinica } from './kit-inicial-clinica';

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const USUARIO_ID = '10000000-0000-4000-8000-000000000002';

function criarRepositorio<T extends Record<string, any>>(iniciais: T[] = []) {
  const registros = [...iniciais];
  return {
    registros,
    create: jest.fn((valor: T) => ({ ...valor })),
    findOne: jest.fn(async () => registros[0] ?? null),
    save: jest.fn(async (valor: T | T[]) => {
      if (Array.isArray(valor)) registros.push(...valor);
      else {
        const existente = registros.find((item) => item.id && item.id === valor.id);
        if (existente) Object.assign(existente, valor);
        else registros.push({ id: `id-${registros.length + 1}`, ...valor } as T);
      }
      return valor;
    })
  };
}

function preparar(managerConfig?: any, materiaisIniciais: any[] = []) {
  const materiais = criarRepositorio(materiaisIniciais);
  const configuracoes = managerConfig ?? criarRepositorio();
  const query = jest.fn(async () => []);
  const manager = {
    query,
    getRepository: jest.fn((entity: Function) => entity === MaterialEducativoOrm ? materiais : configuracoes)
  } as unknown as EntityManager;
  return { manager, query, materiais, configuracoes };
}

describe('instalarKitInicialClinica', () => {
  it('instala apenas materiais e estruturas selecionadas e grava marcador v2', async () => {
    const { manager, query, materiais, configuracoes } = preparar();
    const resultado = await instalarKitInicialClinica(manager, TENANT_ID, USUARIO_ID, [
      'material:registro-habitos',
      'estrutura:tres-refeicoes'
    ], 'opt_in_cliente');

    expect(query).toHaveBeenCalledWith(expect.stringContaining('pg_advisory_xact_lock'), [
      `kit-inicial-clinica:${TENANT_ID}`
    ]);
    expect(materiais.save).toHaveBeenCalledTimes(1);
    expect(materiais.registros).toHaveLength(1);
    expect(materiais.registros[0]).toEqual(expect.objectContaining({
      tenantId: TENANT_ID,
      criadoPorUsuarioId: USUARIO_ID,
      titulo: 'Como registrar hábitos',
      ativo: true
    }));
    expect(configuracoes.registros[0].valor).toEqual({
      versao: VERSAO_KIT_INICIAL_CLINICA,
      itens: ['material:registro-habitos', 'estrutura:tres-refeicoes'],
      instaladoEm: expect.any(String),
      atualizadoEm: expect.any(String),
      origem: 'opt_in_cliente'
    });
    expect(resultado.itensAdicionados).toEqual(['material:registro-habitos', 'estrutura:tres-refeicoes']);
    expect(resultado.materiaisCriados).toBe(1);
    expect(resultado.estruturasHabilitadas).toEqual(['estrutura:tres-refeicoes']);
  });

  it('não altera registros nem datas quando a seleção já está instalada', async () => {
    const marcador = {
      id: 'marcador-existente',
      criadoEm: new Date('2026-01-01T00:00:00.000Z'),
      tenantId: TENANT_ID,
      chave: CHAVE_KIT_INICIAL_CLINICA,
      valor: { versao: 2, itens: ['material:registro-habitos'], instaladoEm: '2026-01-01T00:00:00.000Z', atualizadoEm: '2026-01-01T00:00:00.000Z', origem: 'opt_in_cliente' }
    };
    const config = criarRepositorio([marcador]);
    const materialDesativado = { id: 'material-desativado', tenantId: TENANT_ID, criadoPorUsuarioId: USUARIO_ID, titulo: 'Como registrar hábitos', ativo: false };
    const { manager, materiais } = preparar(config, [materialDesativado]);
    const resultado = await instalarKitInicialClinica(manager, TENANT_ID, USUARIO_ID, ['material:registro-habitos']);
    expect(resultado.reutilizado).toBe(true);
    expect(config.save).not.toHaveBeenCalled();
    expect(materiais.save).not.toHaveBeenCalled();
    expect(materiais.registros).toEqual([materialDesativado]);
  });

  it('complementa por união e preserva a identidade e a data original do marcador', async () => {
    const marcador = {
      id: 'marcador-existente',
      criadoEm: new Date('2026-01-01T00:00:00.000Z'),
      tenantId: TENANT_ID,
      chave: CHAVE_KIT_INICIAL_CLINICA,
      valor: { versao: 2, itens: ['material:registro-habitos'], instaladoEm: '2026-01-01T00:00:00.000Z', atualizadoEm: '2026-01-01T00:00:00.000Z', origem: 'opt_in_cliente' }
    };
    const config = criarRepositorio([marcador]);
    const { manager, materiais } = preparar(config);
    await instalarKitInicialClinica(manager, TENANT_ID, USUARIO_ID, ['material:registro-habitos', 'material:duvidas-consulta']);
    expect(config.registros[0].id).toBe('marcador-existente');
    expect(config.registros[0].criadoEm).toBe(marcador.criadoEm);
    expect(config.registros[0].valor.itens).toEqual(['material:registro-habitos', 'material:duvidas-consulta']);
    expect(materiais.save).toHaveBeenCalledTimes(1);
  });

  it('considera a instalação legada completa sem reescrever nem recriar materiais', async () => {
    const config = criarRepositorio([{
      tenantId: TENANT_ID,
      chave: CHAVE_KIT_INICIAL_CLINICA,
      valor: { versao: 1 }
    }]);
    const { manager, materiais } = preparar(config);
    const resultado = await instalarKitInicialClinica(manager, TENANT_ID, USUARIO_ID, ['estrutura:tres-refeicoes']);
    expect(resultado.reutilizado).toBe(true);
    expect(config.save).not.toHaveBeenCalled();
    expect(materiais.save).not.toHaveBeenCalled();
  });

  it('recusa seleção inválida e marcador inconsistente sem efetuar escrita', async () => {
    const { manager, materiais, configuracoes } = preparar();
    await expect(instalarKitInicialClinica(manager, TENANT_ID, USUARIO_ID, ['material:desconhecido' as never]))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(materiais.save).not.toHaveBeenCalled();

    const invalido = criarRepositorio([{
      tenantId: TENANT_ID,
      chave: CHAVE_KIT_INICIAL_CLINICA,
      valor: { versao: 2, itens: [] }
    }]);
    const segundo = preparar(invalido);
    await expect(instalarKitInicialClinica(segundo.manager, TENANT_ID, USUARIO_ID, ['material:registro-habitos']))
      .rejects.toBeInstanceOf(ConflictException);
    expect(invalido.save).not.toHaveBeenCalled();
    expect(configuracoes.save).not.toHaveBeenCalled();
  });

  it('preserva material manual com título igual e cria a identidade do kit separadamente', async () => {
    const materialManual = { id: 'manual', tenantId: TENANT_ID, criadoPorUsuarioId: USUARIO_ID, titulo: 'Como registrar hábitos', ativo: true };
    const { manager, materiais } = preparar(undefined, [materialManual]);
    const resultado = await instalarKitInicialClinica(manager, TENANT_ID, USUARIO_ID, ['material:registro-habitos'], 'opt_in_cliente');
    expect(resultado.materiaisCriados).toBe(1);
    expect(materiais.registros).toHaveLength(2);
    expect(materiais.registros[0]).toBe(materialManual);
    expect(materiais.registros[1]).toEqual(expect.objectContaining({ titulo: 'Como registrar hábitos', criadoPorUsuarioId: USUARIO_ID }));
  });
});
