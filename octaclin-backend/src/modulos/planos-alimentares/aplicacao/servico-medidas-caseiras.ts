import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { ProfissionalOrm } from '../../profissionais/infraestrutura/profissional.orm';
import { MedidaCaseiraOrm } from '../infraestrutura/medida-caseira.orm';
import { AlimentoComposicaoOrm } from '../infraestrutura/alimento-composicao.orm';
import { FonteComposicaoAlimentoOrm } from '../infraestrutura/fonte-composicao-alimento.orm';
import { calcularPesoMedida } from '../dominio/medidas-caseiras';
export interface ConteudoMedida {
    nome: string;
    quantidadeReferencia: number;
    pesoReferenciaGramas: number;
}
export interface CriarMedidaEntrada extends ConteudoMedida {
    chaveIdempotencia: string;
    escopo?: 'pessoal' | 'clinica';
}
export interface AtualizarMedidaEntrada {
    revisaoEsperada: number;
    nome?: string;
    quantidadeReferencia?: number;
    pesoReferenciaGramas?: number;
    ativa?: false;
}
export interface ReferenciaMedida {
    id: string;
    revisao: number;
}
@Injectable()
export class ServicoMedidasCaseiras {
    constructor(private readonly executor: ExecutorTenant, private readonly crypto: CriptografiaDadosSensiveis) { }
    private async identidade(g: EntityManager, tenantId: string, usuario: UsuarioAutenticado, escrita = true): Promise<string> {
        if (usuario.tenantId !== tenantId || usuario.papel !== 'Professional' || !usuario.permissoes.includes(escrita ? 'planos_alimentares.gerenciar' : 'planos_alimentares.ler'))
            throw new ForbiddenException('Acesso à biblioteca não permitido.');
        const p = await g.getRepository(ProfissionalOrm).findOne({ where: { tenantId, usuarioId: usuario.usuarioId, arquivadoEm: IsNull() }, lock: { mode: 'pessimistic_read' } });
        if (!p)
            throw new ForbiddenException('Vínculo profissional indisponível.');
        return p.id;
    }
    private async alimento(g: EntityManager, id: string) {
        const a = await g.getRepository(AlimentoComposicaoOrm).findOne({ where: { id }, lock: { mode: 'pessimistic_read' } });
        if (!a)
            throw new BadRequestException('Alimento indisponível.');
        const f = await g.getRepository(FonteComposicaoAlimentoOrm).findOne({ where: { id: a.fonteId, situacao: 'ativa' }, lock: { mode: 'pessimistic_read' } });
        if (!f)
            throw new BadRequestException('Fonte do alimento indisponível.');
    }
    private validar(c: ConteudoMedida): ConteudoMedida {
        if (typeof c.nome !== 'string' || !c.nome.trim() || c.nome.trim().length > 40)
            throw new BadRequestException('Nome de medida inválido.');
        try {
            calcularPesoMedida(c.quantidadeReferencia, c.pesoReferenciaGramas, c.quantidadeReferencia);
        }
        catch {
            throw new BadRequestException('Equivalência de medida inválida.');
        }
        return { nome: c.nome.trim(), quantidadeReferencia: c.quantidadeReferencia, pesoReferenciaGramas: c.pesoReferenciaGramas };
    }
    private ler(buffer: Buffer): ConteudoMedida {
        try {
            return this.validar(JSON.parse(this.crypto.descriptografar(buffer)));
        }
        catch {
            throw new ServiceUnavailableException('Medida indisponível.');
        }
    }
    private projetar(m: MedidaCaseiraOrm, profissionalId: string) {
        return { id: m.id, alimentoComposicaoId: m.alimentoComposicaoId, ...this.ler(m.conteudoCriptografado), escopo: m.escopo, revisao: m.revisao, ativa: m.ativa, podeEditar: m.profissionalId === profissionalId };
    }
    async listar(tenantId: string, alimentoId: string, usuario: UsuarioAutenticado, consulta: {
        pagina?: number;
        limite?: number;
    }) {
        return this.executor.executar(tenantId, async (g) => {
            const profissionalId = await this.identidade(g, tenantId, usuario, false);
            const pagina = consulta.pagina ?? 1, limite = consulta.limite ?? 25;
            if (!Number.isInteger(pagina) || pagina < 1 || pagina > 10000 || !Number.isInteger(limite) || limite < 1 || limite > 100)
                throw new BadRequestException('Paginação inválida.');
            const base = { tenantId, alimentoComposicaoId: alimentoId, ativa: true };
            const [itens, total] = await g.getRepository(MedidaCaseiraOrm).findAndCount({ where: [{ ...base, escopo: 'clinica' }, { ...base, escopo: 'pessoal', profissionalId }], order: { criadoEm: 'DESC', id: 'DESC' }, take: limite, skip: (pagina - 1) * limite });
            return { itens: itens.map(m => this.projetar(m, profissionalId)), total, pagina, limite };
        });
    }
    async criar(tenantId: string, alimentoId: string, usuario: UsuarioAutenticado, dados: CriarMedidaEntrada) {
        return this.executor.executar(tenantId, async (g) => {
            const profissionalId = await this.identidade(g, tenantId, usuario);
            const c = this.validar(dados), escopo = dados.escopo ?? 'pessoal';
            if (!['pessoal', 'clinica'].includes(escopo))
                throw new BadRequestException('Escopo inválido.');
            const original = JSON.stringify({ alimentoId, escopo, ...c });
            await g.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`food01:${tenantId}:${profissionalId}:${dados.chaveIdempotencia}`]);
            const repo = g.getRepository(MedidaCaseiraOrm);
            const anterior = await repo.findOne({ where: { tenantId, profissionalId, chaveIdempotencia: dados.chaveIdempotencia } });
            if (anterior) {
                let salvo: string;
                try {
                    salvo = this.crypto.descriptografar(anterior.criacaoSnapshotCriptografado);
                }
                catch {
                    throw new ServiceUnavailableException('Medida indisponível.');
                }
                if (salvo !== original)
                    throw new ConflictException('Chave de criação já utilizada com outros dados.');
                return this.projetar(anterior, profissionalId);
            }
            await this.alimento(g, alimentoId);
            const m = await repo.save(repo.create({ tenantId, profissionalId, alimentoComposicaoId: alimentoId, chaveIdempotencia: dados.chaveIdempotencia, escopo, conteudoCriptografado: this.crypto.criptografar(JSON.stringify(c)), criacaoSnapshotCriptografado: this.crypto.criptografar(original), ativa: true, revisao: 1 }));
            return this.projetar(m, profissionalId);
        });
    }
    async atualizar(tenantId: string, alimentoId: string, id: string, usuario: UsuarioAutenticado, dados: AtualizarMedidaEntrada) {
        return this.executor.executar(tenantId, async (g) => {
            const profissionalId = await this.identidade(g, tenantId, usuario);
            const repo = g.getRepository(MedidaCaseiraOrm);
            const m = await repo.findOne({ where: { id, tenantId, alimentoComposicaoId: alimentoId, profissionalId }, lock: { mode: 'pessimistic_write' } });
            if (!m)
                throw new NotFoundException('Medida não encontrada.');
            if (m.revisao !== dados.revisaoEsperada || m.revisao >= 2147483647)
                throw new ConflictException('Medida alterada. Atualize a lista.');
            const c = this.validar({ ...this.ler(m.conteudoCriptografado), ...(dados.nome !== undefined ? { nome: dados.nome } : {}), ...(dados.quantidadeReferencia !== undefined ? { quantidadeReferencia: dados.quantidadeReferencia } : {}), ...(dados.pesoReferenciaGramas !== undefined ? { pesoReferenciaGramas: dados.pesoReferenciaGramas } : {}) });
            m.conteudoCriptografado = this.crypto.criptografar(JSON.stringify(c));
            if (dados.ativa === false)
                m.ativa = false;
            m.revisao++;
            await repo.save(m);
            return this.projetar(m, profissionalId);
        });
    }
    async resolverAplicacao(g: EntityManager, tenantId: string, usuario: UsuarioAutenticado, alimentoId: string, ref: ReferenciaMedida, quantidade?: number) {
        const profissionalId = await this.identidade(g, tenantId, usuario);
        await this.alimento(g, alimentoId);
        const m = await g.getRepository(MedidaCaseiraOrm).findOne({ where: { id: ref.id, tenantId, alimentoComposicaoId: alimentoId }, lock: { mode: 'pessimistic_read' } });
        if (!m || (m.escopo === 'pessoal' && m.profissionalId !== profissionalId))
            throw new NotFoundException('Medida não encontrada.');
        if (!m.ativa || m.revisao !== ref.revisao)
            throw new ConflictException('Medida alterada ou desativada. Atualize a lista.');
        const c = this.ler(m.conteudoCriptografado);
        let porcaoGramas: number | undefined;
        try {
            if (quantidade !== undefined)
                porcaoGramas = calcularPesoMedida(quantidade, c.pesoReferenciaGramas, c.quantidadeReferencia);
        }
        catch {
            throw new BadRequestException('Quantidade da medida inválida.');
        }
        return { quantidade, unidade: c.nome, porcaoGramas, referencia: { ...c, id: m.id, revisao: m.revisao } };
    }
}
