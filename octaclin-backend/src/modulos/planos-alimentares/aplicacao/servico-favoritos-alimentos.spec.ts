import { randomUUID } from 'crypto';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { AlimentoPersonalizadoOrm } from '../infraestrutura/alimento-personalizado.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { ServicoFavoritosAlimentos } from './servico-favoritos-alimentos';

const tenantId = randomUUID();
const profissionalId = randomUUID();
const usuario: UsuarioAutenticado = { usuarioId: randomUUID(), tenantId, papel: 'Professional', emailHash: 'sintetico', permissoes: ['planos_alimentares.ler', 'planos_alimentares.gerenciar'] };

function ambiente() {
  const prof = { findOne: jest.fn(async () => ({ id: profissionalId })) };
  const catalogo = { findOne: jest.fn(async () => ({ id: 'food', fonteId: 'source' })) };
  const fonte = { findOne: jest.fn(async () => ({ id: 'source', situacao: 'ativa' })) };
  const custom = { findOne: jest.fn(async () => ({ id: 'custom-food', tenantId, profissionalId, escopo: 'pessoal', ativo: true })) };
  const query = jest.fn(async () => []);
  const g = { query, getRepository: (tipo: unknown) => tipo === ProfissionalOrm ? prof : tipo === AlimentoComposicaoOrm ? catalogo : tipo === FonteComposicaoAlimentoOrm ? fonte : tipo === AlimentoPersonalizadoOrm ? custom : {} };
  const executor = { executar: (_tenant: string, operacao: (manager: any) => unknown) => operacao(g) };
  return { prof, catalogo, fonte, custom, query, g, servico: new ServicoFavoritosAlimentos(executor as any) };
}

describe('FOOD03 favoritos privados do profissional', () => {
  it('salva favorito de catálogo com identidade autenticada e comando idempotente', async () => {
    const a = ambiente();
    await a.servico.favoritar(tenantId, usuario, 'catalogo', 'food');
    expect(a.query).toHaveBeenCalledWith(expect.stringContaining('on conflict do nothing'), [tenantId, profissionalId, 'food', null]);
    expect(a.catalogo.findOne).toHaveBeenCalledWith({ where: { id: 'food' } });
    expect(a.fonte.findOne).toHaveBeenCalledWith({ where: { id: 'source', situacao: 'ativa' } });
  });

  it('aceita identidade FOOD02 somente no escopo pessoal atual autorizado', async () => {
    const a = ambiente();
    await a.servico.favoritar(tenantId, usuario, 'custom', 'custom-food');
    expect(a.query).toHaveBeenCalledWith(expect.stringContaining('on conflict do nothing'), [tenantId, profissionalId, null, 'custom-food']);
  });

  it('recusa outro tenant, papel administrativo e alimentos fora de acesso/indisponíveis', async () => {
    const a = ambiente();
    await expect(a.servico.favoritar(randomUUID(), usuario, 'catalogo', 'food')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(a.servico.favoritar(tenantId, { ...usuario, papel: 'SuperAdmin' }, 'catalogo', 'food')).rejects.toBeInstanceOf(ForbiddenException);
    a.custom.findOne.mockResolvedValueOnce({ id: 'custom-food', tenantId, profissionalId: randomUUID(), escopo: 'pessoal', ativo: true } as any);
    await expect(a.servico.favoritar(tenantId, usuario, 'custom', 'custom-food')).rejects.toBeInstanceOf(NotFoundException);
    a.fonte.findOne.mockResolvedValueOnce(null as any);
    await expect(a.servico.favoritar(tenantId, usuario, 'catalogo', 'food')).rejects.toThrow('Alimento indisponível no catálogo.');
  });

  it('desfavoritar ausente é idempotente e usa ambos os discriminadores para não apagar outro ID', async () => {
    const a = ambiente();
    const removidos: unknown[] = [];
    const repo = { delete: async (where: unknown) => { removidos.push(where); } };
    const executor = { executar: (_tenant: string, operacao: (manager: any) => unknown) => operacao({ ...a.g, getRepository: (tipo: unknown) => tipo === ProfissionalOrm ? a.prof : repo }) };
    await new ServicoFavoritosAlimentos(executor as any).desfavoritar(tenantId, usuario, 'custom', 'custom-food');
    expect(removidos[0]).toEqual({ tenantId, profissionalId, alimentoComposicaoId: expect.objectContaining({ _type: 'isNull' }), alimentoPersonalizadoId: 'custom-food' });
  });
});
