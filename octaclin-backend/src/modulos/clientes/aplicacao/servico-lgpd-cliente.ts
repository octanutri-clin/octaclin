import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ExecutorTenant } from '../../../infraestrutura/banco-dados/executor-tenant';
import { ConsentimentoLgpdOrm } from '../../../infraestrutura/lgpd/consentimento-lgpd.orm';
import { lerDetalhesSolicitacaoLgpd } from '../../../infraestrutura/lgpd/detalhes-solicitacao-lgpd';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';

type TipoPedido = 'retificacao' | 'exclusao';
type EstadoPedido = 'recebida' | 'em_tratamento' | 'concluida' | 'indeferida';

interface FiltrosPedido {
  pagina: number;
  limite: number;
  tipo?: TipoPedido;
  status?: EstadoPedido;
}

interface LinhaPedido {
  protocolo: string;
  tipo: string;
  status: string;
  abertoEm: Date;
  atualizadoEm: Date;
  possuiDetalhes: boolean;
}

const TIPOS_EVENTO = [
  'solicitacao_lgpd_retificacao',
  'solicitacao_lgpd_exclusao',
  'tratativa_lgpd',
  'resposta_lgpd_preparada'
];

export function validarFiltrosLgpdCliente(entrada: Record<string, unknown>): FiltrosPedido {
  for (const [chave, valor] of Object.entries(entrada)) {
    if (!['pagina', 'limite', 'tipo', 'status'].includes(chave) || Array.isArray(valor) || typeof valor !== 'string') {
      throw new BadRequestException('Filtros LGPD inválidos.');
    }
  }
  const pagina = entrada.pagina === undefined ? 1 : Number(entrada.pagina);
  const limite = entrada.limite === undefined ? 20 : Number(entrada.limite);
  if (!Number.isInteger(pagina) || pagina < 1 || pagina > 10000 || !Number.isInteger(limite) || limite < 1 || limite > 50) {
    throw new BadRequestException('Paginação LGPD inválida.');
  }
  const tipo = entrada.tipo;
  const status = entrada.status;
  if (tipo !== undefined && tipo !== 'retificacao' && tipo !== 'exclusao') {
    throw new BadRequestException('Tipo LGPD inválido.');
  }
  if (status !== undefined && !['recebida', 'em_tratamento', 'concluida', 'indeferida'].includes(status as string)) {
    throw new BadRequestException('Status LGPD inválido.');
  }
  return { pagina, limite, tipo: tipo as TipoPedido | undefined, status: status as EstadoPedido | undefined };
}

function validarProtocolo(protocolo: string): void {
  if (!/^[a-zA-Z0-9-]{1,80}$/.test(protocolo)) throw new BadRequestException('Protocolo LGPD inválido.');
}

function normalizarEstado(valor: unknown): EstadoPedido {
  if (valor === 'em_tratamento' || valor === 'concluida' || valor === 'indeferida') return valor;
  return 'recebida';
}

function textoMetadado(metadados: Record<string, unknown>, chave: string): string | undefined {
  const valor = metadados[chave];
  return typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;
}

@Injectable()
export class ServicoLgpdCliente {
  constructor(
    private readonly executorTenant: ExecutorTenant,
    private readonly criptografia: CriptografiaDadosSensiveis
  ) {}

  async listar(tenantId: string, entrada: Record<string, unknown> = {}) {
    const filtros = validarFiltrosLgpdCliente(entrada);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const linhas: LinhaPedido[] = await gerenciador.query(`
        select p.metadados->>'protocolo' as protocolo,
               case p.tipo when 'solicitacao_lgpd_retificacao' then 'retificacao' else 'exclusao' end as tipo,
               coalesce(ultimo.status, 'recebida') as status,
               p.aceito_em as "abertoEm",
               coalesce(ultimo.aceito_em, p.aceito_em) as "atualizadoEm",
               (p.detalhes_criptografados is not null or p.metadados ? 'detalhes') as "possuiDetalhes"
        from consentimentos_lgpd p
        left join lateral (
          select t.metadados->>'status' as status, t.aceito_em
          from consentimentos_lgpd t
          where t.tenant_id = p.tenant_id and t.tipo = 'tratativa_lgpd'
            and t.metadados->>'protocolo' = p.metadados->>'protocolo'
          order by t.aceito_em desc, t.id desc limit 1
        ) ultimo on true
        where p.tenant_id = $1
          and p.tipo in ('solicitacao_lgpd_retificacao', 'solicitacao_lgpd_exclusao')
          and p.metadados ? 'protocolo'
          and ($2::text is null or p.tipo = 'solicitacao_lgpd_' || $2::text)
          and ($3::text is null or coalesce(ultimo.status, 'recebida') = $3::text)
        order by p.aceito_em desc, p.id desc
        limit $4 offset $5
      `, [tenantId, filtros.tipo ?? null, filtros.status ?? null, filtros.limite + 1, (filtros.pagina - 1) * filtros.limite]);
      return {
        itens: linhas.slice(0, filtros.limite).map((linha) => ({
          protocolo: linha.protocolo, tipo: linha.tipo,
          status: normalizarEstado(linha.status),
          abertoEm: linha.abertoEm, atualizadoEm: linha.atualizadoEm,
          possuiDetalhes: linha.possuiDetalhes
        })),
        pagina: filtros.pagina,
        limite: filtros.limite,
        temMais: linhas.length > filtros.limite
      };
    });
  }

  async obterDetalhe(tenantId: string, protocolo: string) {
    validarProtocolo(protocolo);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      return this.projetarDetalhe(await this.lerDetalhe(gerenciador, tenantId, protocolo));
    });
  }

  async assumirTratativa(tenantId: string, usuarioId: string, protocolo: string) {
    validarProtocolo(protocolo);
    return this.executorTenant.executar(tenantId, async (gerenciador) => {
      const [original] = await gerenciador.query(`
        select id from consentimentos_lgpd
        where tenant_id = $1 and metadados->>'protocolo' = $2
          and tipo in ('solicitacao_lgpd_retificacao', 'solicitacao_lgpd_exclusao')
        order by aceito_em asc, id asc limit 1 for update
      `, [tenantId, protocolo]);
      if (!original) throw new NotFoundException('Solicitação LGPD não encontrada.');
      const detalhe = await this.lerDetalhe(gerenciador, tenantId, protocolo);
      if (detalhe.status === 'em_tratamento') {
        return { ...this.projetarDetalhe(detalhe), jaEmTratamento: true };
      }
      if (detalhe.status !== 'recebida') throw new ConflictException('Esta solicitação já recebeu decisão final.');

      const repositorio = gerenciador.getRepository(ConsentimentoLgpdOrm);
      await repositorio.save(repositorio.create({
        tenantId, usuarioId, tipo: 'tratativa_lgpd', versao: '2026-10', aceitoEm: new Date(),
        metadados: {
          pacienteId: detalhe.pacienteId,
          protocolo,
          status: 'em_tratamento',
          responsavelId: usuarioId,
          origem: 'cliente'
        }
      }));
      return { ...this.projetarDetalhe(await this.lerDetalhe(gerenciador, tenantId, protocolo)), jaEmTratamento: false };
    });
  }

  async prepararResposta(tenantId: string, protocolo: string) {
    const detalhe = await this.obterDetalhe(tenantId, protocolo);
    if (detalhe.status === 'concluida' || detalhe.status === 'indeferida') {
      throw new ConflictException('A decisão final deve ser comunicada após validação operacional.');
    }
    return {
      protocolo: detalhe.protocolo,
      status: detalhe.status,
      rascunho: `Recebemos seu pedido LGPD ${detalhe.protocolo}. Ele está ${detalhe.status === 'recebida' ? 'registrado para análise' : 'em análise pela clínica'}. Esta resposta será revisada antes do envio.`,
      envioAutomatico: false
    };
  }

  private async lerDetalhe(gerenciador: EntityManager, tenantId: string, protocolo: string) {
    const relacionados: ConsentimentoLgpdOrm[] = await gerenciador.query(`
      select id, tipo, aceito_em as "aceitoEm", metadados,
             detalhes_criptografados as "detalhesCriptografados"
      from consentimentos_lgpd
      where tenant_id = $1 and metadados->>'protocolo' = $2
        and tipo = any($3::text[])
      order by aceito_em asc, id asc
    `, [tenantId, protocolo, TIPOS_EVENTO]);
    const inicial = relacionados.find((evento) =>
      evento.tipo === 'solicitacao_lgpd_retificacao' || evento.tipo === 'solicitacao_lgpd_exclusao'
    );
    if (!inicial) throw new NotFoundException('Solicitação LGPD não encontrada.');
    const historico: { tipo: string; status: EstadoPedido; criadoEm: Date }[] = [];
    let status: EstadoPedido = 'recebida';
    let atualizadoEm = inicial.aceitoEm;
    for (const evento of relacionados) {
      if (evento.tipo === 'tratativa_lgpd') {
        status = normalizarEstado(evento.metadados.status);
        atualizadoEm = evento.aceitoEm;
      }
      historico.push({
        tipo: evento.tipo === 'tratativa_lgpd' ? 'tratativa' : evento.tipo === 'resposta_lgpd_preparada' ? 'rascunho' : 'solicitacao',
        status,
        criadoEm: evento.aceitoEm
      });
    }
    return {
      protocolo,
      pacienteId: textoMetadado(inicial.metadados, 'pacienteId') ?? '',
      tipo: inicial.tipo === 'solicitacao_lgpd_retificacao' ? 'retificacao' as const : 'exclusao' as const,
      status,
      detalhes: lerDetalhesSolicitacaoLgpd(inicial, this.criptografia),
      abertoEm: inicial.aceitoEm,
      atualizadoEm,
      historico
    };
  }

  private projetarDetalhe(detalhe: Awaited<ReturnType<ServicoLgpdCliente['lerDetalhe']>>) {
    return {
      protocolo: detalhe.protocolo,
      tipo: detalhe.tipo,
      status: detalhe.status,
      detalhes: detalhe.detalhes,
      abertoEm: detalhe.abertoEm,
      atualizadoEm: detalhe.atualizadoEm,
      historico: detalhe.historico
    };
  }
}
