import { NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { AgendaConsultaOrm } from '../../agenda/infraestrutura/agenda-consulta.orm';
import { resolverConsultaOpcional } from './vinculo-consulta';

const TENANT_ID = '10000000-0000-4000-8000-000000000001';
const OUTRO_TENANT_ID = '10000000-0000-4000-8000-000000000099';
const PACIENTE_ID = '10000000-0000-4000-8000-000000000002';
const OUTRO_PACIENTE_ID = '10000000-0000-4000-8000-000000000003';
const CONSULTA_ID = '10000000-0000-4000-8000-000000000004';

function gerenciadorCom(consultas: any[]): EntityManager {
  const repositorio = {
    findOne: jest.fn(async ({ where }: any) =>
      consultas.find(
        (consulta) =>
          consulta.id === where.id && consulta.tenantId === where.tenantId && consulta.pacienteId === where.pacienteId
      ) ?? null
    )
  };
  return { getRepository: jest.fn(() => repositorio) } as unknown as EntityManager;
}

describe('resolverConsultaOpcional', () => {
  it('retorna undefined sem consultaId, sem consultar o banco', async () => {
    const gerenciador = gerenciadorCom([]);
    const resultado = await resolverConsultaOpcional(gerenciador, TENANT_ID, PACIENTE_ID, undefined);
    expect(resultado).toBeUndefined();
    expect(gerenciador.getRepository).not.toHaveBeenCalled();
  });

  it('retorna o id quando a consulta pertence ao mesmo tenant e paciente', async () => {
    const gerenciador = gerenciadorCom([{ id: CONSULTA_ID, tenantId: TENANT_ID, pacienteId: PACIENTE_ID }]);
    const resultado = await resolverConsultaOpcional(gerenciador, TENANT_ID, PACIENTE_ID, CONSULTA_ID);
    expect(resultado).toBe(CONSULTA_ID);
  });

  it('rejeita com 404 (nao 403) quando a consulta e de outro paciente', async () => {
    const gerenciador = gerenciadorCom([{ id: CONSULTA_ID, tenantId: TENANT_ID, pacienteId: OUTRO_PACIENTE_ID }]);
    await expect(resolverConsultaOpcional(gerenciador, TENANT_ID, PACIENTE_ID, CONSULTA_ID)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('rejeita com 404 quando a consulta e de outro tenant', async () => {
    const gerenciador = gerenciadorCom([{ id: CONSULTA_ID, tenantId: OUTRO_TENANT_ID, pacienteId: PACIENTE_ID }]);
    await expect(resolverConsultaOpcional(gerenciador, TENANT_ID, PACIENTE_ID, CONSULTA_ID)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('rejeita com 404 quando a consulta nao existe', async () => {
    const gerenciador = gerenciadorCom([]);
    await expect(resolverConsultaOpcional(gerenciador, TENANT_ID, PACIENTE_ID, CONSULTA_ID)).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it('usa o repositorio de AgendaConsultaOrm', async () => {
    const gerenciador = gerenciadorCom([{ id: CONSULTA_ID, tenantId: TENANT_ID, pacienteId: PACIENTE_ID }]);
    await resolverConsultaOpcional(gerenciador, TENANT_ID, PACIENTE_ID, CONSULTA_ID);
    expect(gerenciador.getRepository).toHaveBeenCalledWith(AgendaConsultaOrm);
  });
});
