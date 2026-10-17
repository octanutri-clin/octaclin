import { randomUUID } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import * as contrato from './servico-medidas-caseiras';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
const tenant = randomUUID(), profissional = randomUUID(), alimento = randomUUID(), fonte = randomUUID();
const usuario: UsuarioAutenticado = { tenantId: tenant, usuarioId: randomUUID(), papel: 'Professional', emailHash: 'fixture', permissoes: ['planos_alimentares.ler', 'planos_alimentares.gerenciar'] };
const criar = () => ({ chaveIdempotencia: randomUUID(), nome: 'colher', quantidadeReferencia: 1, pesoReferenciaGramas: 25, escopo: 'pessoal' });
function ambiente() {
    const registros: any[] = [];
    const repo = {
        create: jest.fn(v => ({ ...v })),
        save: jest.fn(async (v) => { if (!v.id) {
            v.id = randomUUID();
            v.criadoEm = new Date();
            registros.push(v);
        } return v; }),
        findOne: jest.fn(async ({ where }) => registros.find(v => Object.entries(where).every(([k, val]) => v[k] === val)) ?? null),
        findAndCount: jest.fn(async () => [registros, registros.length])
    };
    const profRepo = { findOne: jest.fn(async () => ({ id: profissional })) };
    const foodRepo = { findOne: jest.fn(async () => ({ id: alimento, fonteId: fonte })) };
    const sourceRepo = { findOne: jest.fn(async () => ({ id: fonte, situacao: 'ativa' })) };
    const manager = { query: jest.fn(async () => []), getRepository: jest.fn(classe => classe === ProfissionalOrm ? profRepo : classe === AlimentoComposicaoOrm ? foodRepo : classe === FonteComposicaoAlimentoOrm ? sourceRepo : repo) };
    const executor = { executar: jest.fn(async (_: string, f: any) => f(manager)) };
    const crypto = new CriptografiaDadosSensiveis();
    const Classe = (contrato as any).ServicoMedidasCaseiras;
    const servico = new Classe(executor, crypto);
    return { servico, registros, repo, profRepo, sourceRepo, foodRepo, manager, crypto };
}
describe('FOOD01 biblioteca autorizada', () => {
    beforeAll(() => expect(typeof (contrato as any).ServicoMedidasCaseiras).toBe('function'));
    it('cria pessoal por padrão, cifra conteúdo e projeta só campos permitidos', async () => {
        const a = ambiente(), dto = criar();
        delete (dto as any).escopo;
        const v = await a.servico.criar(tenant, alimento, usuario, dto);
        expect(v).toEqual({ id: expect.any(String), alimentoComposicaoId: alimento, nome: 'colher', quantidadeReferencia: 1, pesoReferenciaGramas: 25, escopo: 'pessoal', revisao: 1, ativa: true, podeEditar: true });
        expect(a.registros[0].conteudoCriptografado).toBeInstanceOf(Buffer);
        expect(JSON.stringify(a.registros)).not.toContain('colher');
    });
    it('replay retorna a mesma criação, mas payload divergente é conflito', async () => {
        const a = ambiente(), dto = criar();
        const first = await a.servico.criar(tenant, alimento, usuario, dto);
        expect((await a.servico.criar(tenant, alimento, usuario, dto)).id).toBe(first.id);
        expect(a.registros).toHaveLength(1);
        await expect(a.servico.criar(tenant, alimento, usuario, { ...dto, pesoReferenciaGramas: 30 })).rejects.toBeInstanceOf(ConflictException);
    });
    it('edição exige propriedade e revisão, preservando o replay original', async () => {
        const a = ambiente(), dto = criar();
        const v = await a.servico.criar(tenant, alimento, usuario, dto);
        const atualizado = await a.servico.atualizar(tenant, alimento, v.id, usuario, { revisaoEsperada: 1, nome: 'colher rasa', quantidadeReferencia: 1, pesoReferenciaGramas: 20 });
        expect(atualizado.revisao).toBe(2);
        expect((await a.servico.criar(tenant, alimento, usuario, dto)).nome).toBe('colher rasa');
        await expect(a.servico.atualizar(tenant, alimento, v.id, usuario, { revisaoEsperada: 1, ativa: false })).rejects.toBeInstanceOf(ConflictException);
        a.registros[0].profissionalId = randomUUID();
        await expect(a.servico.atualizar(tenant, alimento, v.id, usuario, { revisaoEsperada: 2, ativa: false })).rejects.toBeInstanceOf(NotFoundException);
    });
    it('aplicação confere alimento, escopo, estado e revisão', async () => {
        const a = ambiente();
        const v = await a.servico.criar(tenant, alimento, usuario, criar());
        const aplicar = (id = alimento, revisao = 1) => a.servico.resolverAplicacao(a.manager, tenant, usuario, id, { id: v.id, revisao }, 2.5);
        expect(await aplicar()).toMatchObject({ unidade: 'colher', porcaoGramas: 62.5, quantidade: 2.5 });
        await expect(aplicar(randomUUID())).rejects.toBeInstanceOf(NotFoundException);
        await expect(aplicar(alimento, 2)).rejects.toBeInstanceOf(ConflictException);
        a.registros[0].profissionalId = randomUUID();
        await expect(aplicar()).rejects.toBeInstanceOf(NotFoundException);
        a.registros[0].escopo = 'clinica';
        expect(await aplicar()).toMatchObject({ porcaoGramas: 62.5 });
        a.registros[0].ativa = false;
        await expect(aplicar()).rejects.toBeInstanceOf(ConflictException);
    });
    it('listagem usa OR restrito a tenant/alimento e identidade autenticada', async () => {
        const a = ambiente();
        await a.servico.listar(tenant, alimento, usuario, {});
        expect(a.repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: [{ tenantId: tenant, alimentoComposicaoId: alimento, escopo: 'clinica', ativa: true }, { tenantId: tenant, alimentoComposicaoId: alimento, escopo: 'pessoal', profissionalId: profissional, ativa: true }], take: 25, skip: 0, order: { criadoEm: 'DESC', id: 'DESC' } }));
    });
    it('vínculo ausente ou papel/tenant indevido não acessa biblioteca', async () => {
        const a = ambiente();
        a.profRepo.findOne.mockResolvedValue(null as never);
        await expect(a.servico.criar(tenant, alimento, usuario, criar())).rejects.toBeInstanceOf(ForbiddenException);
        for (const u of [{ ...usuario, papel: 'SuperAdmin' }, { ...usuario, tenantId: randomUUID() }, { ...usuario, permissoes: [] }]) {
            await expect(a.servico.listar(tenant, alimento, u, {})).rejects.toBeInstanceOf(ForbiddenException);
        }
    });
    it('fonte suspensa bloqueia inserção/aplicação, sem escrita', async () => {
        const a = ambiente();
        a.sourceRepo.findOne.mockResolvedValue(null as never);
        await expect(a.servico.criar(tenant, alimento, usuario, criar())).rejects.toBeInstanceOf(BadRequestException);
        expect(a.registros).toHaveLength(0);
    });
});
