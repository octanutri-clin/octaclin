import { resumirRespostas, PerguntaResumo } from './resumo-respostas';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { ServicoQuestionarios, RespostaQuestionarioRecebida, LeituraClinicaQuestionario } from './servico-questionarios';
import { CriptografiaDadosSensiveis } from '../../../infraestrutura/seguranca/criptografia-dados-sensiveis';
import { obterTimezoneClinicoDoTenant } from '../../../infraestrutura/tempo/timezone-clinico';
import { UsuarioAutenticado } from '../../auth/dominio/usuario-autenticado';
import { CursorRespostas, FiltrosPaginaRespostas, normalizarConsultaRespostas, PosicaoResposta } from './consulta-respostas';
import { RespostaValorOrm } from '../infraestrutura/resposta-valor.orm';
import { PerguntaOrm } from '../infraestrutura/pergunta.orm';
import { PerguntaSnapshotQuestionario } from '../infraestrutura/envio-questionario.orm';
import { validarTipoPergunta } from '../dominio/tipos-pergunta';
import { formatarCsvRespostas } from './csv-respostas';

interface MetadadoResposta extends PosicaoResposta { pacienteId: string; envioId: string }
interface EnvioBloqueado { id:string; snapshot: { perguntas?: PerguntaSnapshotQuestionario[] } | null }
export interface PaginaRespostasQuestionario extends LeituraClinicaQuestionario {
  questionarioId: string;
  filtros: Omit<FiltrosPaginaRespostas, 'cursor'>;
  timezone: string;
  totalConsulta: number;
  proximoCursor: string | null;
  respostas: RespostaQuestionarioRecebida[];
}
const LIMITE_BYTES = 8 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class ServicoRespostasPaginadas {
  constructor(private readonly questionarios: ServicoQuestionarios, private readonly cripto: CriptografiaDadosSensiveis) {}

  async consultar(tenantId: string, questionarioId: string, usuario: UsuarioAutenticado, entrada: Record<string, unknown>): Promise<PaginaRespostasQuestionario> {
    const { cursor, ...filtros } = normalizarConsultaRespostas(entrada);
    return this.questionarios.lerQuestionarioAutorizado(tenantId, questionarioId, usuario, async (m, profissionalId) => {
      const timezone = await obterTimezoneClinicoDoTenant(m, tenantId);
      const contexto = { tenantId, questionarioId, usuarioId: usuario.usuarioId, timezone, filtros };
      const codec = new CursorRespostas(this.cripto);
      const posicao = cursor ? codec.abrir(contexto, cursor) : undefined;
      const resultado = await this.selecionar(m, tenantId, questionarioId, profissionalId, filtros, timezone, filtros.tamanho + 1, posicao);
      const pagina = resultado.dados.slice(0, filtros.tamanho);
      const dados = await this.hidratar(m, tenantId, questionarioId, profissionalId, pagina);
      const leitura = resumirRespostas(questionarioId,dados.respostas,dados.perguntas,filtros.pacienteId,true,dados.incompativeis);
      if (Buffer.byteLength(JSON.stringify(leitura)) > LIMITE_BYTES) throw new BadRequestException('Consulta muito grande. Refine os filtros.');
      return { ...leitura, filtros, timezone, totalConsulta: resultado.total,
        proximoCursor: resultado.dados.length > filtros.tamanho && pagina.length ? codec.criar(contexto, {id: pagina[pagina.length - 1].id, finalizadoEm: pagina[pagina.length - 1].finalizadoEm}) : null,
        };
    });
  }

  async exportar(tenantId: string, questionarioId: string, usuario: UsuarioAutenticado, entrada: Record<string, unknown>, ids?: string[]): Promise<string> {
    const {cursor, ...filtros} = normalizarConsultaRespostas(entrada);
    if (cursor || entrada.tamanho !== undefined) throw new BadRequestException('A exportação usa o conjunto da consulta, sem cursor ou tamanho de página.');
    let selecionados: string[] | undefined;
    if (ids !== undefined) {
      if (!Array.isArray(ids) || !ids.length || ids.length > 1000 || ids.some(id => typeof id !== 'string' || !UUID.test(id))) throw new BadRequestException('Selecione entre 1 e 1000 envios válidos.');
      selecionados = ids.map(id => id.toLowerCase());
      if (new Set(selecionados).size !== selecionados.length) throw new BadRequestException('Seleção de respostas inválida.');
    }
    return this.questionarios.lerQuestionarioAutorizado(tenantId, questionarioId, usuario, async (m, profissionalId) => {
      const timezone = await obterTimezoneClinicoDoTenant(m, tenantId);
      const resultado = await this.selecionar(m, tenantId, questionarioId, profissionalId, filtros, timezone, 1001, undefined, selecionados);
      if (resultado.total > 1000) throw new BadRequestException('A exportação excede 1000 respostas. Refine o período ou o paciente.');
      if (selecionados && resultado.dados.length !== selecionados.length) throw new NotFoundException('Seleção indisponível. Atualize a consulta.');
      const respostas = await this.hidratar(m, tenantId, questionarioId, profissionalId, resultado.dados);
      const csv = formatarCsvRespostas(respostas.respostas);
      if (Buffer.byteLength(csv) > LIMITE_BYTES) throw new BadRequestException('Exportação muito grande. Refine os filtros.');
      return csv;
    });
  }

  private async selecionar(m: EntityManager, tenantId: string, questionarioId: string, profissionalId: string | undefined,
    filtros: Omit<FiltrosPaginaRespostas, 'cursor'>, timezone: string, limite: number, posicao?: PosicaoResposta, ids?: string[]) {
    // Patient selection is itself authorized, even if its result has no responses.
    if (filtros.pacienteId) await this.travarPacientes(m, tenantId, profissionalId, [filtros.pacienteId]);
    const [linha] = await m.query(`WITH elegiveis AS MATERIALIZED (
      SELECT r.id, r.paciente_id, r.envio_questionario_id, r.finalizado_em FROM respostas_checkin r
      JOIN envios_questionario e ON e.id=r.envio_questionario_id AND e.tenant_id=r.tenant_id AND e.paciente_id=r.paciente_id
      JOIN pacientes p ON p.id=r.paciente_id AND p.tenant_id=r.tenant_id
      WHERE r.tenant_id=$1 AND e.questionario_id=$2 AND e.status='respondido'
        AND p.arquivado_em IS NULL AND p.status_ciclo_vida NOT IN ('DELETED','DELETION_PENDING')
        AND ($3::uuid IS NULL OR p.profissional_responsavel_id=$3)
        AND ($4::uuid IS NULL OR r.paciente_id=$4)
        AND ($5::date IS NULL OR r.finalizado_em >= ($5::date::timestamp AT TIME ZONE $7))
        AND ($6::date IS NULL OR r.finalizado_em < (($6::date + 1)::timestamp AT TIME ZONE $7))
        AND ($11::uuid[] IS NULL OR r.id=ANY($11))
    ), pagina AS (
      SELECT * FROM elegiveis r WHERE $8::uuid IS NULL
        OR ($9::timestamptz IS NOT NULL AND (r.finalizado_em < $9 OR (r.finalizado_em=$9 AND r.id<$8) OR r.finalizado_em IS NULL))
        OR ($9::timestamptz IS NULL AND r.finalizado_em IS NULL AND r.id<$8)
      ORDER BY r.finalizado_em DESC NULLS LAST,r.id DESC LIMIT $10
    ) SELECT (SELECT count(*) FROM elegiveis)::text AS total,
      COALESCE(json_agg(json_build_object('id',id,'pacienteId',paciente_id,'envioId',envio_questionario_id,'finalizadoEm',finalizado_em::text)
        ORDER BY finalizado_em DESC NULLS LAST,id DESC),'[]') AS dados FROM pagina`,
    [tenantId,questionarioId,profissionalId ?? null,filtros.pacienteId ?? null,filtros.inicio ?? null,filtros.fim ?? null,timezone,posicao?.id ?? null,posicao?.finalizadoEm ?? null,limite,ids ?? null]);
    return {total: Number(linha.total), dados: linha.dados as MetadadoResposta[]};
  }

  private async travarPacientes(m: EntityManager, tenantId: string, profissionalId: string | undefined, ids: string[]) {
    const pacientes: {id: string}[] = await m.query(`SELECT id FROM pacientes WHERE tenant_id=$1 AND id=ANY($2::uuid[])
      AND arquivado_em IS NULL AND status_ciclo_vida NOT IN ('DELETED','DELETION_PENDING')
      AND ($3::uuid IS NULL OR profissional_responsavel_id=$3) ORDER BY id FOR SHARE`, [tenantId,[...new Set(ids)].sort(),profissionalId ?? null]);
    if (pacientes.length !== new Set(ids).size) throw new NotFoundException('Consulta indisponível. Atualize os filtros.');
  }

  private async hidratar(m: EntityManager, tenantId: string, questionarioId: string, profissionalId: string | undefined, pagina: MetadadoResposta[]): Promise<{respostas: RespostaQuestionarioRecebida[]; perguntas: PerguntaResumo[]; incompativeis: Set<string>}> {
    if (!pagina.length) return {respostas:[],perguntas:[],incompativeis:new Set()};
    await this.travarPacientes(m, tenantId, profissionalId, pagina.map(r => r.pacienteId));
    // Same global resource order as historical reads: questionnaire → patients → sends → responses.
    const envios = [...new Set(pagina.map(r => r.envioId))].sort();
    await m.query('SELECT id FROM envios_questionario WHERE tenant_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR SHARE', [tenantId,envios]);
    const ids = pagina.map(r => r.id).sort();
    const bloqueados: MetadadoResposta[] = await m.query(`SELECT r.id,r.paciente_id AS "pacienteId",r.envio_questionario_id AS "envioId",
      r.finalizado_em::text AS "finalizadoEm"
      FROM respostas_checkin r JOIN envios_questionario e ON e.id=r.envio_questionario_id AND e.tenant_id=r.tenant_id AND e.paciente_id=r.paciente_id
      WHERE r.tenant_id=$1 AND r.id=ANY($2::uuid[]) AND e.questionario_id=$3 AND e.status='respondido' ORDER BY r.id FOR SHARE OF r`, [tenantId,ids,questionarioId]);
    const porId = new Map(bloqueados.map(r => [r.id,r]));
    if (pagina.some(r => { const atual=porId.get(r.id); return !atual || atual.pacienteId!==r.pacienteId || atual.envioId!==r.envioId || atual.finalizadoEm!==r.finalizadoEm; })) throw new ConflictException('A consulta mudou. Atualize antes de continuar.');
    const [volume] = await m.query(`SELECT (
      (SELECT COALESCE(sum(octet_length(valor::text)),0) FROM resposta_valores WHERE tenant_id=$1 AND resposta_checkin_id=ANY($2::uuid[])) +
      (SELECT COALESCE(sum(octet_length(snapshot_estrutura::text)),0) FROM envios_questionario WHERE tenant_id=$1 AND id=ANY($3::uuid[]))
    )::text AS bytes`, [tenantId,ids,envios]);
    if (Number(volume.bytes)>LIMITE_BYTES) throw new BadRequestException('Consulta muito grande. Refine os filtros.');
    const historicos: EnvioBloqueado[] = await m.query('SELECT id,snapshot_estrutura AS snapshot FROM envios_questionario WHERE tenant_id=$1 AND id=ANY($2::uuid[]) ORDER BY id', [tenantId,envios]);
    const historicosPorId=new Map(historicos.map(e=>[e.id,e]));
    const valores = await m.getRepository(RespostaValorOrm).find({where:{tenantId,respostaCheckinId:In(ids)}, select:{respostaCheckinId:true,perguntaId:true,valor:true},order:{id:'ASC'}});
    // Preserve the existing legacy fallback only for labels, never for historical completeness.
    const legadas = historicos.some(r=>!Array.isArray(r.snapshot?.perguntas));
    const atuais = legadas ? await m.getRepository(PerguntaOrm).find({where:{tenantId,questionarioId},select:{id:true,enunciado:true,tipo:true},order:{ordem:'ASC',id:'ASC'}}) : [];
    const porResposta = new Map<string, typeof valores>();
    for (const valor of valores) { const lista=porResposta.get(valor.respostaCheckinId) ?? []; lista.push(valor); porResposta.set(valor.respostaCheckinId,lista); }
    const definicoes = new Map<string, PerguntaResumo>();
    const assinaturas = new Map<string,string>();
    const incompativeis = new Set<string>();
    const respostas = pagina.map(r=>{
      const envio=historicosPorId.get(r.envioId)!;
      const perguntas = Array.isArray(envio.snapshot?.perguntas) ? envio.snapshot.perguntas : atuais;
      const mapa = new Map(perguntas.map(p=>[p.id,p]));
      const respostas=(porResposta.get(r.id) ?? []).flatMap(v=>{
        const p=mapa.get(v.perguntaId);
        if (p && typeof p.enunciado==='string' && validarTipoPergunta(p.tipo)) {
          const cfg = 'configuracao' in p && p.configuracao && typeof p.configuracao==='object' ? p.configuracao as Record<string,unknown> : {};
          const campos=Object.keys(cfg).filter(k=>!['secao','placeholder','ajuda'].includes(k)).sort();
          const assinatura=JSON.stringify([p.tipo,p.enunciado,campos.map(k=>[k,cfg[k]])]);
          if (!Array.isArray(envio.snapshot?.perguntas) || (assinaturas.has(p.id) && assinaturas.get(p.id)!==assinatura)) incompativeis.add(p.id);
          assinaturas.set(p.id,assinatura);definicoes.set(p.id,{id:p.id,enunciado:p.enunciado,tipo:p.tipo});
        }
        return p && typeof p.enunciado==='string' && validarTipoPergunta(p.tipo) ? [{perguntaId:p.id,enunciado:p.enunciado,tipo:p.tipo,valor:v.valor}] : [];
      });
      return {respostaId:r.id,envioId:r.envioId,pacienteId:r.pacienteId,questionarioId,finalizadoEm:r.finalizadoEm ? new Date(r.finalizadoEm) : undefined,totalRespostas:respostas.length,respostas};
    });
    return {respostas,perguntas:[...definicoes.values()],incompativeis};
  }
}
