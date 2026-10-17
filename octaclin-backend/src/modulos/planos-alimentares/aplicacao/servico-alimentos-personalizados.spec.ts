import { randomUUID } from 'crypto';
import { ForbiddenException, NotFoundException, ConflictException, BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ServicoAlimentosPersonalizados } from './servico-alimentos-personalizados';
const tenant = randomUUID(), profissional = randomUUID();
const usuario: UsuarioAutenticado = { usuarioId: randomUUID(), tenantId: tenant, papel: 'Professional', emailHash: 'sintetico', permissoes: ['planos_alimentares.ler', 'planos_alimentares.gerenciar'] };
const dados = () => ({ nome: 'Arroz sintético', base: { tipo: 'porcao', pesoGramas: 30 }, nutrientes: { energiaKcal: 90 }, chaveIdempotencia: randomUUID() });
function ambiente() {
  const registros: any[] = [];
  function corresponde(v: any, w: any): boolean { return Object.entries(w).every(([k, n]: any) => n?._type === 'arrayContains' ? n._value.every((h: string) => v[k].includes(h)) : v[k] === n); }
  const repo = { create: (v: any) => ({ ...v }), save: async (v: any) => { if (!v.id) { v.id = randomUUID(); v.criadoEm = new Date(); registros.push(v); } return v; },
    findOne: async ({ where }: any) => registros.find(v => corresponde(v, where)) ?? null,
    findAndCount: async ({ where, take, skip }: any) => { const rows = registros.filter(v => where.some((w: any) => corresponde(v, w))); return [rows.slice(skip, skip + take), rows.length]; } };
  const prof = { findOne: jest.fn(async () => ({ id: profissional })) };
  const g = { getRepository: (t: any) => t === ProfissionalOrm ? prof : repo, query: jest.fn(async () => []) };
  const crypto = new CriptografiaDadosSensiveis();
  const s = new ServicoAlimentosPersonalizados({ executar: async (_: string, f: any) => f(g) } as any, crypto);
  return { registros, prof, g, crypto, s };
}
describe('FOOD02 biblioteca autorizada', () => {
  it('cria cifrado, idempotente, projeta mínimo e usa índice HMAC', async () => {
    const a = ambiente(), d = dados();
    const r = await a.s.criar(tenant, usuario, d as any);
    expect(r).toMatchObject({ nome: d.nome, escopo: 'pessoal', revisao: 1, ativo: true, nutrientesPor100g: { energiaKcal: 300 }, podeEditar: true });
    expect(await a.s.criar(tenant, usuario, d as any)).toEqual(r);
    expect(a.registros).toHaveLength(1);
    expect(a.crypto.descriptografar(a.registros[0].conteudoCriptografado)).toContain('Arroz sintético');
    expect(a.registros[0].buscaHashes).not.toContain('arroz');
    for (const k of ['tenantId', 'profissionalId', 'conteudoCriptografado', 'buscaHashes', 'criacaoSnapshotCriptografado', 'chaveIdempotencia']) expect(r).not.toHaveProperty(k);
    expect((await a.s.obter(tenant, usuario, r.id)).composicaoOrigem!.nutrientes.energiaKcal).toBe(90);
    await expect(a.s.criar(tenant, usuario, { ...d, nome: 'outro' } as any)).rejects.toBeInstanceOf(ConflictException);
  });
  it('pesquisa paginada usa escopo e acentos, sem contaminar catálogo', async () => {
    const a = ambiente();
    const r = await a.s.criar(tenant, usuario, dados() as any);
    const outro = { ...a.registros[0], id: randomUUID(), profissionalId: randomUUID() }; a.registros.push(outro);
    expect((await a.s.listar(tenant, usuario, {})).total).toBe(1);
    outro.escopo = 'clinica';
    expect((await a.s.buscar(tenant, usuario, { busca: 'arr sint', limite: 1 })).total).toBe(2);
    expect((await a.s.listar(tenant, usuario, { escopo: 'clinica' })).itens[0].podeEditar).toBe(false);
    await expect(a.s.obter(tenant, usuario, randomUUID())).rejects.toBeInstanceOf(NotFoundException);
    await expect(a.s.atualizar(tenant, usuario, outro.id, { revisaoEsperada: 1, ativo: false } as any)).rejects.toBeInstanceOf(NotFoundException);
    outro.tenantId = randomUUID();
    expect((await a.s.listar(tenant, usuario, {})).itens.map((i: any) => i.id)).toEqual([r.id]);
  });
  it('CAS e desativação não ressuscitam a mesma criação nem permitem reaplicação antiga', async () => {
    const a = ambiente(), d = dados(), r = await a.s.criar(tenant, usuario, d as any);
    const ref = { id: r.id, revisao: 1 };
    await a.s.atualizar(tenant, usuario, r.id, { revisaoEsperada: 1, ativo: false } as any);
    expect((await a.s.listar(tenant, usuario, {})).total).toBe(0);
    expect((await a.s.criar(tenant, usuario, d as any)).ativo).toBe(false);
    await expect(a.s.resolverAplicacao(a.g as any, tenant, usuario, ref)).rejects.toBeInstanceOf(ConflictException);
    await expect(a.s.atualizar(tenant, usuario, r.id, { revisaoEsperada: 1, ativo: false } as any)).rejects.toBeInstanceOf(ConflictException);
  });
  it.each(['Client', 'SuperAdmin', 'Patient'])('nega papel %s mesmo com permissões', async papel => {
    const a = ambiente(); await expect(a.s.criar(tenant, { ...usuario, papel } as any, dados() as any)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('nega tenant incompatível, permissão ausente e vínculo revogado', async () => {
    const a = ambiente();
    await expect(a.s.listar(randomUUID(), usuario, {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(a.s.criar(tenant, { ...usuario, permissoes: ['planos_alimentares.ler'] }, dados() as any)).rejects.toBeInstanceOf(ForbiddenException);
    a.prof.findOne.mockResolvedValueOnce(null as any);
    await expect(a.s.listar(tenant, usuario, {})).rejects.toBeInstanceOf(ForbiddenException);
  });
  it.each(['!!!', 'de um', 'a'.repeat(33)])('não transforma busca inválida em listagem: %s', async busca => {
    await expect(ambiente().s.buscar(tenant, usuario, { busca })).rejects.toBeInstanceOf(BadRequestException);
  });
  it('recusa composição adulterada, corrupta e medidas com base inválida', async () => {
    const a = ambiente();
    await expect(a.s.criar(tenant, usuario, { ...dados(), base: { tipo: 'ml' } } as any)).rejects.toBeInstanceOf(BadRequestException);
    const r = await a.s.criar(tenant, usuario, dados() as any);
    a.registros[0].conteudoCriptografado = Buffer.from('corrompido');
    await expect(a.s.obter(tenant, usuario, r.id)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
