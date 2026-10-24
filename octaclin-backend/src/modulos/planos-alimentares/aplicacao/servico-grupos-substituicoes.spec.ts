import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { GrupoSubstituicoesOrm } from '../infraestrutura/grupo-substituicoes.orm';
import { ServicoGruposSubstituicoes } from './servico-grupos-substituicoes';
const tenant = randomUUID(), criador = randomUUID(), outro = randomUUID();
const profissional = (id = criador): UsuarioAutenticado => ({ usuarioId: id, tenantId: tenant, emailHash: 'sintetico', papel: 'Professional', permissoes: ['planos_alimentares.ler','planos_alimentares.gerenciar','grupos_substituicoes.compartilhar'] as any });
const admin: UsuarioAutenticado = { ...profissional(), usuarioId: randomUUID(), papel: 'Client', permissoes: ['grupos_substituicoes.administrar'] as any };
const dados = (escopo: 'pessoal'|'clinica' = 'pessoal') => ({ chaveIdempotencia: randomUUID(), escopo, conteudo: { nome: 'Grupo sintético', categoria: 'Livre', entradas: [{ id: randomUUID(), origem: 'catalogo' as const, alimentoId: randomUUID(), quantidade: 1, unidade: 'porção', porcaoGramas: 40 }] } });
function ambiente() {
  const tabelas = new Map<any, any[]>(); let vinculo = true;
  const repo = (tipo: any) => {
    const rows = tabelas.get(tipo) ?? []; tabelas.set(tipo, rows);
    return { create: (d: any) => ({ ...d }),
      findOne: async ({ where }: any) => {
        if (tipo === ProfissionalOrm) return vinculo ? { id: where.usuarioId, tenantId: where.tenantId } : null;
        const r = rows.find(x => Object.entries(where).every(([k,v]) => x[k] === v)); return r ? { ...r } : null;
      }, save: async (d: any) => { const v = { ...d, id: d.id ?? randomUUID(), criadoEm: d.criadoEm ?? new Date() }; const i=rows.findIndex(x => x.id===v.id); i<0?rows.push(v):rows.splice(i,1,v); return v; },
      find: async ({ where }: any = {}) => rows.filter(x => !where || Object.entries(where).every(([k,v]) => x[k]===v)),
      delete: async ({ tenantId,profissionalId,grupoId }: any) => { const i=rows.findIndex(x => x.tenantId===tenantId&&x.profissionalId===profissionalId&&x.grupoId===grupoId); if(i>=0)rows.splice(i,1); }
    };
  };
  const g = { getRepository: repo, query: jest.fn(async () => []) };
  const fontes = { resolver: jest.fn(async (_g: any,_t: string,_p: string|undefined,_s: string,e: any) => ({ ...e, composicao: { descricao: 'Alimento sintético', nutrientesPor100g: { energiaKcal: 100 }, fonte: { codigo:'sintetica',versao:'1',hashConteudo:'a'.repeat(64) } } })) };
  const crypto = new CriptografiaDadosSensiveis();
  const s = new ServicoGruposSubstituicoes({ executar: async (_: string, f: any) => f(g) } as any, crypto, fontes as any);
  return { s, fontes, crypto, g, rows: () => tabelas.get(GrupoSubstituicoesOrm)!, revogar: () => { vinculo = false; } };
}
describe('FOOD04 biblioteca e administração segregadas', () => {
  it('cria cifrado com DTO mínimo; replay é independente de atualizações de composição', async () => {
    const a=ambiente(), d=dados(), r=await a.s.criar(tenant,profissional(),d);
    expect(r).toMatchObject({ escopo:'pessoal',estado:'ativo',revisao:1,nome:'Grupo sintético',podeEditar:true });
    expect((await a.s.criar(tenant,profissional(),d)).id).toBe(r.id);
    expect(a.rows()).toHaveLength(1);
    expect(a.crypto.descriptografar(a.rows()[0].conteudoCriptografado)).toContain('Grupo sintético');
    for(const campo of ['tenantId','profissionalId','criadoPorUsuarioId','conteudoCriptografado','criacaoSnapshotCriptografado','origemCopia','buscaHashes']) expect(r).not.toHaveProperty(campo);
    await expect(a.s.criar(tenant,profissional(),{ ...d,conteudo:{ ...d.conteudo,nome:'Outro' } })).rejects.toBeInstanceOf(ConflictException);
  });
  it('CAS permite arquivar/restaurar sem recriar e nega revisão anterior', async () => {
    const a=ambiente(),d=dados(),r=await a.s.criar(tenant,profissional(),d);
    expect(await a.s.atualizar(tenant,profissional(),r.id,{ revisaoEsperada:1,estado:'arquivado' })).toMatchObject({ estado:'arquivado',revisao:2 });
    await expect(a.s.atualizar(tenant,profissional(),r.id,{ revisaoEsperada:1,estado:'ativo' })).rejects.toBeInstanceOf(ConflictException);
    expect(await a.s.atualizar(tenant,profissional(),r.id,{ revisaoEsperada:2,estado:'ativo' })).toMatchObject({ estado:'ativo',revisao:3 });
    expect((await a.s.criar(tenant,profissional(),d)).revisao).toBe(3);
  });
  it('admin não lê pessoal mesmo com capacidade específica e outro profissional não o reutiliza', async () => {
    const a=ambiente(),r=await a.s.criar(tenant,profissional(),dados());
    await expect(a.s.obter(tenant,admin,r.id,true)).rejects.toBeInstanceOf(NotFoundException);
    await expect(a.s.obter(tenant,profissional(outro),r.id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(a.s.duplicar(tenant,profissional(outro),r.id,{ ...dados(),revisaoEsperada:1 })).rejects.toBeInstanceOf(NotFoundException);
  });
  it('admin mantém compartilhado de criador desligado; não personifica profissional', async () => {
    const a=ambiente(),r=await a.s.criar(tenant,profissional(),dados('clinica'));
    a.revogar();
    expect(await a.s.atualizar(tenant,admin,r.id,{ revisaoEsperada:1,estado:'arquivado' },true)).toMatchObject({ estado:'arquivado',podeEditar:true });
    await expect(a.s.obter(tenant,profissional(),r.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(a.rows()[0].profissionalId).toBe(criador);
    expect(a.rows()[0].alteradoPorUsuarioId).toBe(admin.usuarioId);
  });
  it('outro profissional lê compartilhado, mas não o edita; admin exige rota/capacidade própria', async () => {
    const a=ambiente(),r=await a.s.criar(tenant,profissional(),dados('clinica'));
    expect(await a.s.obter(tenant,profissional(outro),r.id)).toMatchObject({ podeEditar:false });
    await expect(a.s.atualizar(tenant,profissional(outro),r.id,{ revisaoEsperada:1,estado:'arquivado' })).rejects.toBeInstanceOf(NotFoundException);
    await expect(a.s.obter(tenant,admin,r.id)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(a.s.obter(tenant,{ ...admin,permissoes:[] },r.id,true)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(a.s.obter(randomUUID(),admin,r.id,true)).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('duplica como pessoal independente com origem interna; original não altera cópia', async () => {
    const a=ambiente(),r=await a.s.criar(tenant,profissional(),dados('clinica'));
    const d={ ...dados(),revisaoEsperada:1 };
    const c=await a.s.duplicar(tenant,profissional(outro),r.id,d);
    expect(c).toMatchObject({ escopo:'pessoal',revisao:1 }); expect(c.id).not.toBe(r.id);
    expect((await a.s.duplicar(tenant,profissional(outro),r.id,d)).id).toBe(c.id);
    await a.s.atualizar(tenant,profissional(),r.id,{ revisaoEsperada:1,estado:'arquivado' });
    expect(await a.s.obter(tenant,profissional(outro),c.id)).toMatchObject({ estado:'ativo',revisao:1 });
    expect(a.crypto.descriptografar(a.rows().find(v=>v.id===c.id).conteudoCriptografado)).toContain(r.id);
    expect(c).not.toHaveProperty('origemCopia');
  });
  it('nega promoção sem capacidade ou PATCH ambíguo também no serviço', async () => {
    const a=ambiente(),r=await a.s.criar(tenant,profissional(),dados());
    await expect(a.s.atualizar(tenant,{ ...profissional(),permissoes:['planos_alimentares.gerenciar'] },r.id,{ revisaoEsperada:1,escopo:'clinica' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(a.s.atualizar(tenant,profissional(),r.id,{ revisaoEsperada:1,estado:'ativo',escopo:'clinica' } as any)).rejects.toBeInstanceOf(BadRequestException);
  });
  it('nega permissões/vínculo/papel removidos e conteúdo cifrado corrupto', async () => {
    const a=ambiente();
    await expect(a.s.criar(tenant,admin,dados())).rejects.toBeInstanceOf(ForbiddenException);
    const r=await a.s.criar(tenant,profissional(),dados()); a.rows()[0].conteudoCriptografado=Buffer.from('corrompido');
    await expect(a.s.obter(tenant,profissional(),r.id)).rejects.toBeInstanceOf(ServiceUnavailableException);
    a.revogar(); await expect(a.s.criar(tenant,profissional(),dados())).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('FOOD04 primeira aplicação exige autorização atual',()=>{
  it('revalida versão/entrada/escopo e recusa nova aplicação após arquivamento',async()=>{
    const a=ambiente(),d=dados(),r=await a.s.criar(tenant,profissional(),d);
    const ref={grupoId:r.id,revisao:1,entradaId:d.conteudo.entradas[0].id,aplicacaoId:randomUUID()};
    expect(await (a.s as any).resolverAplicacao(a.g,tenant,profissional(),ref)).toMatchObject({id:ref.entradaId});
    await expect((a.s as any).resolverAplicacao(a.g,tenant,profissional(outro),ref)).rejects.toBeInstanceOf(NotFoundException);
    await a.s.atualizar(tenant,profissional(),r.id,{revisaoEsperada:1,estado:'arquivado'});
    await expect((a.s as any).resolverAplicacao(a.g,tenant,profissional(),ref)).rejects.toBeInstanceOf(ConflictException);
  });
});
