import { registrarAuditoriaNaTransacao } from "../../../infraestrutura/auditoria/servico-auditoria";
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ServicoConfiguracaoPiloto } from "../../gamificacao/aplicacao/servico-configuracao-piloto";
import { EntityManager } from "typeorm";
import { ExecutorTenant } from "../../../infraestrutura/banco-dados/executor-tenant";
import { UsuarioAutenticado } from "../../auth/dominio/usuario-autenticado";
import {
  autorizarProfissional318,
  contextoSessao318,
  ConteudoRascunhos318,
  DIREITOS_IA318,
  MODELOS_IA318,
  Modelo318,
} from "../dominio/rascunhos-clinicos";
export interface Contexto318 {
  m: EntityManager;
  u: UsuarioAutenticado;
  profissionalId: string;
  profissionalVersao: string;
  usuarioVersao: string;
  tenantVersao: string;
}
export interface Paciente318 {
  id: string;
  versao_contexto_ia318: string;
}
export interface Config318 {
  contextoSessao?: string;
  habilitada: boolean;
  versao: number;
  operacaoAprovada: boolean;
  maxChamadas15min: number;
  maxTokensSaida: number;
}
@Injectable()
export class ContextoRascunhos318 {
  constructor(
    private readonly executor: ExecutorTenant,
    readonly conteudo: ConteudoRascunhos318,
    @Inject(DIREITOS_IA318)
    readonly direitos: boolean,
    @Inject(MODELOS_IA318)
    readonly modelos: Modelo318[],
  ) {}
  operacaoAprovada(): boolean {
    return (
      this.direitos &&
      this.modelos.length > 0 &&
      process.env.IA_RASCUNHOS_OPERACAO_APROVADA === "true"
    );
  }
  async executar<T>(
    u: UsuarioAutenticado,
    op: (c: Contexto318) => Promise<T>,
  ): Promise<T> {
    autorizarProfissional318(u);
    return this.executor.executar(u.tenantId, async (m) => {
      // Same serialization point already used by clinical patient/profile writers.
      await m.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
        `gamificacao317:${u.tenantId}`,
      ]);
      const perfis = await m.query(
        `select pr.id,pr.versao_contexto_ia318,u.versao_contexto_ia318 as usuario_versao,t.versao_contexto_ia318 as tenant_versao from profissionais pr
     join usuarios u on u.tenant_id=pr.tenant_id and u.id=pr.usuario_id join tenants t on t.id=pr.tenant_id
     where pr.tenant_id=$1 and pr.usuario_id=$2 and pr.arquivado_em is null and u.ativo=true and u.role='Professional' and t.status='ativo' and t.ciclo_vida_status in ('primeiro_uso_validado','acompanhamento_48h','ativo','ativo_assistido') and t.encerrado_em is null
     for share of pr,u,t`,
        [u.tenantId, u.usuarioId],
      );
      if (perfis.length !== 1)
        throw new ForbiddenException("Vínculo profissional indisponível.");
      if (u.sessaoId) {
        const [sessao] = await m.query(
          "select id from sessoes_usuario where tenant_id=$1 and usuario_id=$2 and id=$3 and revogado_em is null and expira_em>now() for share",
          [u.tenantId, u.usuarioId, u.sessaoId],
        );
        if (!sessao) throw new ForbiddenException("Sessão indisponível.");
      }
      return op({
        m,
        u,
        profissionalId: perfis[0].id,
        profissionalVersao: String(perfis[0].versao_contexto_ia318),
        usuarioVersao: String(perfis[0].usuario_versao),
        tenantVersao: String(perfis[0].tenant_versao),
      });
    });
  }
  async paciente(c: Contexto318, id: string): Promise<Paciente318> {
    const [p] = await c.m.query(
      `select id,versao_contexto_ia318 from pacientes where tenant_id=$1 and id=$2 and profissional_responsavel_id=$3
    and arquivado_em is null and status_ciclo_vida='ACTIVE' for share`,
      [c.u.tenantId, id, c.profissionalId],
    );
    if (!p) throw new NotFoundException("Paciente não encontrado no escopo.");
    return p;
  }
  async config(m: EntityManager, tenantId: string): Promise<Config318> {
    const [row] = await m.query(
      "select valor from tenant_configuracoes where tenant_id=$1 and chave='ia_rascunhos318' for share",
      [tenantId],
    );
    const v = row?.valor;
    const versaoValida = Number.isSafeInteger(v?.versao) && v.versao >= 0;
    const chamadas = v?.maxChamadas15min ?? 5,
      tokens = v?.maxTokensSaida ?? 2048;
    const limitesValidos =
      Number.isInteger(chamadas) &&
      chamadas >= 1 &&
      chamadas <= 5 &&
      Number.isInteger(tokens) &&
      tokens >= 256 &&
      tokens <= 2048;
    return {
      habilitada: versaoValida && limitesValidos && v?.habilitada === true,
      versao: versaoValida ? v.versao : 0,
      operacaoAprovada: this.operacaoAprovada(),
      maxChamadas15min: limitesValidos ? chamadas : 5,
      maxTokensSaida: limitesValidos ? tokens : 2048,
    };
  }
  async exigirGeracao(c: Contexto318): Promise<Config318> {
    const config = await this.config(c.m, c.u.tenantId);
    if (!config.operacaoAprovada || !config.habilitada)
      throw new ForbiddenException(
        "Assistência aguarda validação e liberação da clínica.",
      );
    return config;
  }
  async credencial(c: Contexto318) {
    const [row] = await c.m.query(
      "select usuario_id,chave_criptografada,versao from credenciais_ia318 where tenant_id=$1 and profissional_id=$2 for update",
      [c.u.tenantId, c.profissionalId],
    );
    if (row && row.usuario_id !== c.u.usuarioId)
      throw new ForbiddenException("Credencial indisponível neste vínculo.");
    return row;
  }
  async obterCredencial(u: UsuarioAutenticado) {
    return this.executar(u, async (c) => {
      const row = await this.credencial(c);
      return {
        estado: row?.chave_criptografada ? "cadastrada" : "ausente",
        versao: row?.versao ?? 0,
      };
    });
  }
  async definirCredencial(
    u: UsuarioAutenticado,
    d: {
      chave: string;
      versaoEsperada: number;
      contextoSessao: string;
    },
  ) {
    if (!this.direitos)
      throw new ForbiddenException(
        "Cadastro aguarda revisão contratual da integração.",
      );
    if (
      typeof d.chave !== "string" ||
      !d.chave.trim() ||
      d.chave.length > 1024 ||
      /[\s\x00-\x1f\x7f]/.test(d.chave)
    )
      throw new ConflictException(
        "Confira a credencial, sem espaços ou quebras de linha.",
      );
    return this.executar(u, async (c) =>
      this.gravarCredencial(c, d.versaoEsperada, d.chave, d.contextoSessao),
    );
  }
  async removerCredencial(
    u: UsuarioAutenticado,
    d: {
      versaoEsperada: number;
      contextoSessao: string;
    },
  ) {
    return this.executar(u, (c) =>
      this.gravarCredencial(c, d.versaoEsperada, null, d.contextoSessao),
    );
  }
  /** Escrita compartilhada: caller deve autorizar finalidade e executar no contexto verificado. */
  async gravarCredencial(
    c: Contexto318,
    esperada: number,
    chave: string | null,
    contextoSessao: string,
  ) {
    if (contextoSessao !== contextoSessao318(c.u))
      throw new ConflictException(
        "Contexto da sessão mudou. Confira novamente.",
      );
    const row = await this.credencial(c);
    if ((row?.versao ?? 0) !== esperada)
      throw new ConflictException("Configuração mudou. Confira novamente.");
    const versao = esperada + 1;
    const bytes = chave
      ? this.conteudo.cifrar(
          `${c.u.tenantId}:${c.profissionalId}:${c.u.usuarioId}:credencial:${versao}`,
          chave,
        )
      : null;
    await c.m.query(
      `insert into credenciais_ia318(tenant_id,profissional_id,usuario_id,chave_criptografada,versao) values($1,$2,$3,$4,$5)
    on conflict(tenant_id,profissional_id) do update set chave_criptografada=excluded.chave_criptografada,versao=excluded.versao,atualizado_em=now()`,
      [c.u.tenantId, c.profissionalId, c.u.usuarioId, bytes, versao],
    );
    await registrarAuditoriaNaTransacao(c.m, {
      tenantId: c.u.tenantId,
      usuarioId: c.u.usuarioId,
      acao: chave ? "ia318.credencial.definir" : "ia318.credencial.remover",
      recursoTipo: "integracao_ia",
    });
    return { estado: chave ? "cadastrada" : "ausente", versao };
  }
  async configurar(
    u: UsuarioAutenticado,
    d?: {
      contextoSessao: string;
      habilitada: boolean;
      versaoEsperada: number;
      maxChamadas15min?: number;
      maxTokensSaida?: number;
    },
  ): Promise<Config318> {
    if (
      u.papel !== "Client" ||
      !u.permissoes.includes("cliente.configuracoes.gerenciar")
    )
      throw new ForbiddenException("Acesso exclusivo do gestor da clínica.");
    return this.executor.executar(u.tenantId, async (m) => {
      await m.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
        `gamificacao317:${u.tenantId}`,
      ]);
      const [ator] = await m.query(
        "select id from usuarios where tenant_id=$1 and id=$2 and ativo=true and role='Client' for share",
        [u.tenantId, u.usuarioId],
      );
      if (!ator) throw new ForbiddenException("Acesso indisponível.");
      if (u.sessaoId) {
        const [s] = await m.query(
          "select id from sessoes_usuario where tenant_id=$1 and usuario_id=$2 and id=$3 and revogado_em is null and expira_em>now() for share",
          [u.tenantId, u.usuarioId, u.sessaoId],
        );
        if (!s) throw new ForbiddenException("Sessão indisponível.");
      }
      return this.alterarConfiguracao(m, u.tenantId, u, d);
    });
  }
  async configurarOperacoes(
    u: UsuarioAutenticado,
    tenantId: string,
    d?: {
      contextoSessao: string;
      habilitada: boolean;
      versaoEsperada: number;
      maxChamadas15min?: number;
      maxTokensSaida?: number;
    },
  ): Promise<Config318> {
    if (
      u.papel !== "SuperAdmin" ||
      !u.permissoes.includes("operacoes.tenants.gerenciar")
    )
      throw new ForbiddenException("Acesso operacional indisponível.");
    // Reuse verified administrative target scope; this path never reads clinical sources or credentials.
    return new ServicoConfiguracaoPiloto(this.executor).executarAdministrativo(
      tenantId,
      u,
      async (m) => {
        await m.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
          `gamificacao317:${tenantId}`,
        ]);
        return this.alterarConfiguracao(m, tenantId, u, d);
      },
    );
  }
  private async alterarConfiguracao(
    m: EntityManager,
    tenantId: string,
    u: UsuarioAutenticado,
    d?: {
      contextoSessao: string;
      habilitada: boolean;
      versaoEsperada: number;
      maxChamadas15min?: number;
      maxTokensSaida?: number;
    },
  ): Promise<Config318> {
    const config = await this.config(m, tenantId);
    const contextoSessao = contextoSessao318(u);
    if (!d) return { ...config, contextoSessao };
    if (d.contextoSessao !== contextoSessao)
      throw new ConflictException(
        "Contexto da sessão mudou. Confira novamente.",
      );
    if (d.habilitada && !config.operacaoAprovada)
      throw new ForbiddenException(
        "Integração aguarda validações obrigatórias.",
      );
    if (d.versaoEsperada !== config.versao)
      throw new ConflictException("Configuração mudou. Confira novamente.");
    const chamadas = d.maxChamadas15min ?? config.maxChamadas15min,
      tokens = d.maxTokensSaida ?? config.maxTokensSaida;
    if (
      !Number.isInteger(chamadas) ||
      chamadas < 1 ||
      chamadas > 5 ||
      !Number.isInteger(tokens) ||
      tokens < 256 ||
      tokens > 2048
    )
      throw new ConflictException("Confira os limites de chamadas e tokens.");
    const valor = {
      habilitada: d.habilitada,
      versao: config.versao + 1,
      maxChamadas15min: chamadas,
      maxTokensSaida: tokens,
    };
    await m.query(
      "insert into tenant_configuracoes(tenant_id,chave,valor) values($1,'ia_rascunhos318',$2) on conflict(tenant_id,chave) do update set valor=excluded.valor",
      [tenantId, valor],
    );
    await registrarAuditoriaNaTransacao(m, {
      tenantId: tenantId,
      usuarioId: u.usuarioId,
      acao: "ia318.configuracao.alterar",
      recursoTipo: "integracao_ia",
    });
    return {
      ...valor,
      operacaoAprovada: config.operacaoAprovada,
      contextoSessao,
    };
  }
}
