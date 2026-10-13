import { registrarAuditoriaNaTransacao } from "../../../infraestrutura/auditoria/servico-auditoria";
import { criarEvolucaoNoContexto } from "../../pacientes/aplicacao/criar-evolucao-no-contexto";
import { EvolucaoClinicaOrm } from "../../pacientes/infraestrutura/evolucao-clinica.orm";
import { CriarEvolucaoClinicaDto } from "../../pacientes/aplicacao/dtos";
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { CriptografiaDadosSensiveis } from "../../../infraestrutura/seguranca/criptografia-dados-sensiveis";
import {
  dataIsoNoTimezoneClinico,
  obterTimezoneClinicoDoTenant,
} from "../../../infraestrutura/tempo/timezone-clinico";
import { UsuarioAutenticado } from "../../auth/dominio/usuario-autenticado";
import {
  contextoSessao318,
  Fonte318,
  fingerprint318,
  POLITICA318,
  validarFontes318,
  validarSaida318,
} from "../dominio/rascunhos-clinicos";
import {
  projetarEvolucao318,
  projetarMedida318,
} from "../dominio/fontes-clinicas318";
import { AdaptadorOpenAi318 } from "../infraestrutura/adaptador-openai318";
import { Contexto318, ContextoRascunhos318 } from "./contexto-rascunhos318";
export interface Gerar318 {
  contextoSessao: string;
  chaveComando: string;
  modeloId: string;
  selecoes: {
    tipo: "preparacao" | "evolucao" | "medida";
    id: string;
  }[];
  textoProfissional?: string;
}
export type Modalidade318 = "pre_consulta" | "evolucao";
@Injectable()
export class ServicoRascunhosClinicosIa {
  constructor(
    readonly base: ContextoRascunhos318,
    private readonly provider: AdaptadorOpenAi318,
    private readonly cripto: CriptografiaDadosSensiveis,
  ) {}
  private chave(d: string) {
    if (!/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(d))
      throw new BadRequestException("Chave de comando inválida.");
  }
  private escopo(u: UsuarioAutenticado, chave: string) {
    return `${u.tenantId}:${u.usuarioId}:comando:${chave}`;
  }
  private async disponiveis(
    c: Contexto318,
    pacienteId: string,
  ): Promise<Fonte318[]> {
    const evolucoes = await c.m.query(
      "select id,titulo,titulo_criptografado,conteudo_criptografado,criado_em from evolucoes_clinicas where tenant_id=$1 and paciente_id=$2 order by criado_em desc,id desc limit 3 for share",
      [c.u.tenantId, pacienteId],
    );
    const medidas = await c.m.query(
      "select id,avaliada_em::text,medidas_criptografadas from avaliacoes_antropometricas where tenant_id=$1 and paciente_id=$2 and excluida_em is null order by avaliada_em desc,criado_em desc,id desc limit 3 for share",
      [c.u.tenantId, pacienteId],
    );
    const [atendimento] = await c.m.query(
      "select inicio_em from agenda_consultas where tenant_id=$1 and paciente_id=$2 and status='concluida' order by inicio_em desc,id desc limit 1",
      [c.u.tenantId, pacienteId],
    );
    const hoje = dataIsoNoTimezoneClinico(
      await obterTimezoneClinicoDoTenant(c.m, c.u.tenantId),
    );
    let texto =
      "Sem consulta concluída anterior. Consulte o histórico e registre o contexto da primeira consulta.";
    if (atendimento) {
      const [contadores] = await c.m.query(
        `select
    (select count(*)::int from logs_diario_rapido where tenant_id=$1 and paciente_id=$2 and registrado_em>$3) as checkins,
    (select count(*)::int from respostas_checkin where tenant_id=$1 and paciente_id=$2 and finalizado_em>$3) as formularios,
    (select count(*)::int from mensagens_notificacao where tenant_id=$1 and paciente_id=$2 and status='recebido' and criado_em>$3) as mensagens`,
        [c.u.tenantId, pacienteId, atendimento.inicio_em],
      );
      texto = `Desde o atendimento em ${new Date(atendimento.inicio_em).toISOString()}: ${contadores.checkins} registros de diário/check-in; ${contadores.formularios} formulários respondidos; ${contadores.mensagens} mensagens recebidas. Contagens não comprovam adesão ou consumo. Planos e conteúdo de mensagens/formulários não incluídos.`;
    }
    return [
      {
        ref: "preparacao:resumo",
        tipo: "preparacao",
        data: atendimento
          ? new Date(atendimento.inicio_em).toISOString()
          : hoje,
        texto,
      },
      ...evolucoes.map((r: any) => projetarEvolucao318(r, this.cripto)),
      ...medidas.map((r: any) => projetarMedida318(r, this.cripto)),
    ];
  }
  async fontes(
    u: UsuarioAutenticado,
    pacienteId: string,
    contextoSessao: string,
  ) {
    return this.base.executar(u, async (c) => {
      this.conferirSessao(c, contextoSessao);
      await this.base.paciente(c, pacienteId);
      await this.base.exigirGeracao(c);
      return {
        fontes: await this.disponiveis(c, pacienteId),
        cobertura: { evolucoes: 3, medidas: 3, examesIncluidos: false },
      };
    });
  }
  private conferirSessao(c: Contexto318, marcador: string) {
    if (marcador !== contextoSessao318(c.u))
      throw new ConflictException(
        "Contexto da sessão mudou. Confira novamente.",
      );
  }
  private async preparar(
    c: Contexto318,
    pacienteId: string,
    d: Gerar318,
    modalidade: Modalidade318,
  ) {
    const p = await this.base.paciente(c, pacienteId),
      config = await this.base.exigirGeracao(c),
      credencial = await this.base.credencial(c),
      modelo = this.base.modelos.find((m) => m.id === d.modeloId);
    if (!credencial?.chave_criptografada || !modelo)
      throw new ConflictException(
        "Configure uma credencial e um modelo aprovado.",
      );
    if (
      !Array.isArray(d.selecoes) ||
      d.selecoes.length > 20 ||
      d.selecoes.filter((s) => s.tipo === "evolucao").length > 3
    )
      throw new BadRequestException("Confira a seleção de fontes.");
    const disponiveis = await this.disponiveis(c, pacienteId);
    const fontes = d.selecoes.map((s) => {
      const f = disponiveis.find((f) => f.ref === `${s.tipo}:${s.id}`);
      if (!f)
        throw new NotFoundException("Fonte não disponível. Confira novamente.");
      return f;
    });
    if (d.textoProfissional?.trim()) {
      if (modalidade !== "evolucao")
        throw new BadRequestException(
          "Texto da consulta só pode compor o rascunho de evolução.",
        );
      fontes.push({
        ref: "nota:profissional",
        tipo: "nota_profissional",
        data: dataIsoNoTimezoneClinico(
          await obterTimezoneClinicoDoTenant(c.m, c.u.tenantId),
        ),
        texto: d.textoProfissional.trim(),
      });
    }
    validarFontes318(fontes);
    if (!fontes.length)
      throw new BadRequestException(
        "Selecione contexto ou registre o texto da consulta.",
      );
    const vinculo = {
      tenantId: c.u.tenantId,
      pacienteId,
      autor: c.u.usuarioId,
      profissional: c.profissionalId,
      sessao: c.u.sessaoId ?? null,
      pacienteVersao: String(p.versao_contexto_ia318),
      profissionalVersao: c.profissionalVersao,
      usuarioVersao: c.usuarioVersao,
      tenantVersao: c.tenantVersao,
      configVersao: config.versao,
      credencialVersao: credencial.versao,
    };
    const stamp = {
      vinculo,
      modelo: { id: modelo.id, versao: modelo.versao },
      politica: POLITICA318,
      modalidade,
      fontes: fontes.map((f) => ({
        ref: f.ref,
        data: f.data,
        digest: fingerprint318(f.texto),
      })),
    };
    return {
      stamp,
      modelo,
      fontes,
      credencial,
      config,
      fontesProvider: fontes.map((f, i) => ({ ...f, ref: `F${i + 1}` })),
    };
  }
  async gerar(
    u: UsuarioAutenticado,
    pacienteId: string,
    d: Gerar318,
    modalidade: Modalidade318,
  ) {
    this.chave(d.chaveComando);
    const preparado = await this.base.executar(u, async (c) => {
      this.conferirSessao(c, d.contextoSessao);
      const x = await this.preparar(c, pacienteId, d, modalidade);
      const [existente] = await c.m.query(
        "select acao,estado from comandos_ia318 where tenant_id=$1 and usuario_id=$2 and chave=$3",
        [u.tenantId, u.usuarioId, d.chaveComando],
      );
      if (existente)
        throw new ConflictException(
          "Geração já solicitada. Não será repetida; use nova ação para gerar novamente.",
        );
      await c.m.query(
        "update comandos_ia318 set estado='incerto' where tenant_id=$1 and usuario_id=$2 and acao='gerar' and estado='iniciado' and criado_em<now()-interval '2 minutes'",
        [u.tenantId, u.usuarioId],
      );
      const [quota] = await c.m.query(
        "select count(*)::int as total,count(*) filter(where estado='iniciado')::int as ativos from comandos_ia318 where tenant_id=$1 and usuario_id=$2 and acao='gerar' and criado_em>now()-interval '15 minutes'",
        [u.tenantId, u.usuarioId],
      );
      if (quota.total >= x.config.maxChamadas15min || quota.ativos > 0)
        throw new ConflictException(
          "Limite de geração atingido ou solicitação em andamento.",
        );
      await c.m.query(
        "insert into comandos_ia318(tenant_id,usuario_id,chave,paciente_id,acao,fingerprint_criptografado,estado) values($1,$2,$3,$4,$5,$6,$7)",
        [
          u.tenantId,
          u.usuarioId,
          d.chaveComando,
          pacienteId,
          "gerar",
          this.base.conteudo.cifrar(
            this.escopo(u, d.chaveComando),
            fingerprint318(x.stamp),
          ),
          "iniciado",
        ],
      );
      await registrarAuditoriaNaTransacao(c.m, {
        tenantId: u.tenantId,
        usuarioId: u.usuarioId,
        acao: "ia318.geracao.solicitar",
        recursoTipo: "integracao_ia",
      });
      return x;
    });
    try {
      const chave = this.base.conteudo.ler<string>(
        `${u.tenantId}:${preparado.stamp.vinculo.profissional}:${u.usuarioId}:credencial:${preparado.credencial.versao}`,
        preparado.credencial.chave_criptografada,
      );
      const saida = validarSaida318(
        await this.provider.gerar(
          chave,
          d.modeloId,
          preparado.fontesProvider,
          modalidade,
          "",
          preparado.config.maxTokensSaida,
        ),
        preparado.fontesProvider,
      );
      return await this.base.executar(u, async (c) => {
        const atual = await this.preparar(c, pacienteId, d, modalidade);
        if (fingerprint318(atual.stamp) !== fingerprint318(preparado.stamp))
          throw new ConflictException(
            "Contexto mudou durante a geração. Confira novamente.",
          );
        const [row] = await c.m.query(
          "select estado from comandos_ia318 where tenant_id=$1 and usuario_id=$2 and chave=$3 for update",
          [u.tenantId, u.usuarioId, d.chaveComando],
        );
        if (row?.estado !== "iniciado")
          throw new ConflictException("Geração indisponível.");
        await c.m.query(
          "update comandos_ia318 set estado='retornado' where tenant_id=$1 and usuario_id=$2 and chave=$3",
          [u.tenantId, u.usuarioId, d.chaveComando],
        );
        const provaRevisao = this.base.conteudo.selar({
          nonceGeracao: d.chaveComando,
          stamp: atual.stamp,
          selecoes: d.selecoes,
          resultadoDigest: fingerprint318(saida),
        });
        return {
          modalidade,
          ...saida,
          texto: saida.itens.map((i) => i.texto).join("\n"),
          modeloId: atual.modelo.id,
          versaoModelo: atual.modelo.versao,
          provaRevisao,
          expiraEm: new Date(Date.now() + 900000).toISOString(),
          referencias: atual.fontes.map((f, i) => ({
            ref: `F${i + 1}`,
            tipo: f.tipo,
            data: f.data,
          })),
          cobertura: {
            fontesSelecionadas: atual.fontes.length,
            limiteEvolucoes: 3,
            limiteMedidas: 3,
            examesIncluidos: false,
          },
          revisaoHumanaObrigatoria: true,
        };
      });
    } catch (e) {
      await this.base
        .executar(u, (c) =>
          c.m.query(
            "update comandos_ia318 set estado='incerto' where tenant_id=$1 and usuario_id=$2 and chave=$3 and estado='iniciado'",
            [u.tenantId, u.usuarioId, d.chaveComando],
          ),
        )
        .catch(() => undefined);
      throw e;
    }
  }
  async confirmar(
    u: UsuarioAutenticado,
    pacienteId: string,
    d: {
      chaveComando: string;
      provaRevisao: string;
      titulo: string;
      conteudo: string;
      tipo?: string;
      consultaId?: string;
      confirmado: boolean;
      textoProfissional?: string;
    },
  ) {
    this.chave(d.chaveComando);
    if (
      d.confirmado !== true ||
      typeof d.titulo !== "string" ||
      !d.titulo.trim() ||
      [...d.titulo].length > 180 ||
      typeof d.conteudo !== "string" ||
      d.conteudo.trim().length < 3 ||
      [...d.conteudo].length > 6000 ||
      !["consulta", "retorno", "observacao", "ajuste_plano"].includes(
        d.tipo ?? "observacao",
      )
    )
      throw new BadRequestException("Confira e confirme a evolução.");
    return this.base.executar(u, async (c) => {
      const paciente = await this.base.paciente(c, pacienteId),
        config = await this.base.exigirGeracao(c),
        credencial = await this.base.credencial(c);
      const prova = this.base.conteudo.abrir<any>(
        d.provaRevisao,
        Date.now(),
        true,
      );
      if (prova?.stamp?.modalidade !== "evolucao" || !prova.nonceGeracao)
        throw new ConflictException("Prévia não pode confirmar uma evolução.");
      const v = prova.stamp.vinculo;
      const atual = {
        tenantId: u.tenantId,
        pacienteId,
        autor: u.usuarioId,
        profissional: c.profissionalId,
        sessao: u.sessaoId ?? null,
        pacienteVersao: String(paciente.versao_contexto_ia318),
        profissionalVersao: c.profissionalVersao,
        usuarioVersao: c.usuarioVersao,
        tenantVersao: c.tenantVersao,
        configVersao: config.versao,
        credencialVersao: credencial?.versao,
      };
      if (
        fingerprint318(v) !== fingerprint318(atual) ||
        prova.stamp.politica !== POLITICA318 ||
        !this.base.modelos.some(
          (m) =>
            m.id === prova.stamp.modelo.id &&
            m.versao === prova.stamp.modelo.versao,
        )
      )
        throw new ConflictException(
          "Contexto da prévia mudou. Confira novamente.",
        );
      const fingerprint = fingerprint318({
        prova: d.provaRevisao,
        titulo: d.titulo.trim(),
        conteudo: d.conteudo.trim(),
        tipo: d.tipo ?? "observacao",
        consultaId: d.consultaId ?? null,
        textoProfissional: d.textoProfissional?.trim() ?? "",
      });
      const [porNonce] = await c.m.query(
        "select acao,estado,resultado_id,fingerprint_criptografado,geracao_chave from comandos_ia318 where tenant_id=$1 and usuario_id=$2 and chave=$3 for update",
        [u.tenantId, u.usuarioId, d.chaveComando],
      );
      const [porGeracao] = await c.m.query(
        "select acao,estado,resultado_id,fingerprint_criptografado,geracao_chave,chave from comandos_ia318 where tenant_id=$1 and usuario_id=$2 and geracao_chave=$3 and acao='confirmar' for update",
        [u.tenantId, u.usuarioId, prova.nonceGeracao],
      );
      const existente = porNonce ?? porGeracao;
      if (existente) {
        const nonce = porNonce ? d.chaveComando : existente.chave;
        if (
          existente.acao !== "confirmar" ||
          existente.estado !== "confirmado" ||
          this.base.conteudo.ler<string>(
            this.escopo(u, nonce),
            existente.fingerprint_criptografado,
          ) !== fingerprint
        )
          throw new ConflictException("Comando já usado com outra operação.");
        const row = await c.m.getRepository(EvolucaoClinicaOrm).findOne({
          where: {
            id: existente.resultado_id,
            tenantId: u.tenantId,
            pacienteId,
          },
        });
        if (!row) throw new NotFoundException("Evolução indisponível.");
        return this.projetarEvolucao(row);
      }
      this.base.conteudo.abrir(d.provaRevisao);
      const [geracao] = await c.m.query(
        "select acao,estado,paciente_id,fingerprint_criptografado from comandos_ia318 where tenant_id=$1 and usuario_id=$2 and chave=$3 for update",
        [u.tenantId, u.usuarioId, prova.nonceGeracao],
      );
      if (
        geracao?.acao !== "gerar" ||
        geracao.estado !== "retornado" ||
        geracao.paciente_id !== pacienteId ||
        this.base.conteudo.ler<string>(
          this.escopo(u, prova.nonceGeracao),
          geracao.fingerprint_criptografado,
        ) !== fingerprint318(prova.stamp)
      )
        throw new ConflictException("Geração não disponível para confirmação.");
      const preparada = await this.preparar(
        c,
        pacienteId,
        {
          contextoSessao: contextoSessao318(c.u),
          chaveComando: prova.nonceGeracao,
          modeloId: prova.stamp.modelo.id,
          selecoes: prova.selecoes,
          textoProfissional: d.textoProfissional,
        },
        "evolucao",
      );
      if (fingerprint318(preparada.stamp) !== fingerprint318(prova.stamp))
        throw new ConflictException("Fontes mudaram. Confira novamente.");
      const row = await criarEvolucaoNoContexto(
        c.m,
        this.cripto,
        u.tenantId,
        pacienteId,
        u.usuarioId,
        {
          titulo: d.titulo,
          conteudo: d.conteudo,
          tipo: d.tipo ?? "observacao",
          visibilidade: "privada",
          consultaId: d.consultaId,
        } as CriarEvolucaoClinicaDto,
      );
      await c.m.query(
        "insert into proveniencias_ia318(tenant_id,paciente_id,evolucao_id,snapshot_criptografado) values($1,$2,$3,$4)",
        [
          u.tenantId,
          pacienteId,
          row.id,
          this.base.conteudo.cifrar(`${u.tenantId}:${row.id}:proveniencia`, {
            ...prova.stamp,
            resultadoDigest: prova.resultadoDigest,
            resultadoAceitoDigest: fingerprint318(d.conteudo.trim()),
            revisaoHumanaConfirmada: true,
          }),
        ],
      );
      await c.m.query(
        "insert into comandos_ia318(tenant_id,usuario_id,chave,paciente_id,acao,fingerprint_criptografado,estado,resultado_id,geracao_chave) values($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [
          u.tenantId,
          u.usuarioId,
          d.chaveComando,
          pacienteId,
          "confirmar",
          this.base.conteudo.cifrar(
            this.escopo(u, d.chaveComando),
            fingerprint,
          ),
          "confirmado",
          row.id,
          prova.nonceGeracao,
        ],
      );
      await registrarAuditoriaNaTransacao(c.m, {
        tenantId: u.tenantId,
        usuarioId: u.usuarioId,
        acao: "ia318.evolucao.confirmar",
        recursoTipo: "integracao_ia",
      });
      return this.projetarEvolucao(row);
    });
  }
  private projetarEvolucao(e: EvolucaoClinicaOrm) {
    return {
      id: e.id,
      tenantId: e.tenantId,
      pacienteId: e.pacienteId,
      autorUsuarioId: e.autorUsuarioId,
      titulo: e.tituloCriptografado
        ? this.cripto.descriptografar(e.tituloCriptografado)
        : (e.titulo ?? ""),
      conteudo: this.cripto.descriptografar(e.conteudoCriptografado),
      tipo: e.tipo,
      visibilidade: e.visibilidade,
      consultaId: e.consultaId,
      criadoEm: e.criadoEm,
      atualizadoEm: e.atualizadoEm,
    };
  }
}
