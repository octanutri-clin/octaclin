import { registrarAuditoriaNaTransacao } from "../../../infraestrutura/auditoria/servico-auditoria";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from "@nestjs/common";
import { randomUUID } from "crypto";
import { Contexto318, ContextoRascunhos318 } from "./contexto-rascunhos318";
import { AdaptadorOpenAi318 } from "../infraestrutura/adaptador-openai318";
import {
  contextoSessao318,
  fingerprint318,
  Modelo318,
  validarSaida318,
} from "../dominio/rascunhos-clinicos";
import { UsuarioAutenticado } from "../../auth/dominio/usuario-autenticado";
import {
  casoSintetico318,
  casosSinteticos318,
  comporSintetico318,
  CORPUS_SINTETICO318,
} from "../dominio/piloto-sintetico318";
export interface PoliticaPiloto318 {
  ativo: boolean;
  direitos: boolean;
  modelos: Modelo318[];
}
export const POLITICA_PILOTO318 = Symbol("POLITICA_PILOTO318");
export const PROVIDER_PILOTO318 = Symbol("PROVIDER_PILOTO318");
/** Nao ratifica contratos: ativacao exige evidencia humana e alteracao revisada. */
export const DIREITOS_PILOTO318_APROVADOS = false;
interface ProvaPiloto {
  casoId: string;
  nonce: string;
  stamp: string;
  corpus: string;
}
interface LedgerPiloto {
  comandos: { nonce: string; em: number }[];
  ocupadoAte: number;
}
@Injectable()
export class ServicoPilotoSintetico318 {
  constructor(
    private readonly base: ContextoRascunhos318,
    @Inject(PROVIDER_PILOTO318) private readonly provider: AdaptadorOpenAi318,
    @Inject(POLITICA_PILOTO318) private readonly politica: PoliticaPiloto318,
  ) {}
  private async executar<T>(
    u: UsuarioAutenticado,
    fn: (c: Contexto318, versao: number) => Promise<T>,
  ): Promise<T> {
    if (!u.sessaoId || this.politica.ativo !== true)
      throw new ForbiddenException("Piloto sintético não liberado.");
    return this.base.executar(u, async (c) => {
      const [row] = await c.m.query(
        "select valor from tenant_configuracoes where tenant_id=$1 and chave='ia318_piloto_sintetico' for share",
        [u.tenantId],
      );
      const v = row?.valor;
      if (
        v?.habilitada !== true ||
        v.usuarioId !== u.usuarioId ||
        v.profissionalId !== c.profissionalId ||
        !Number.isSafeInteger(v.versao) ||
        v.versao < 1
      )
        throw new ForbiddenException(
          "Piloto sintético não liberado para este vínculo.",
        );
      return fn(c, v.versao);
    });
  }
  private stamp(c: Contexto318, versao: number, credencialVersao: number) {
    return fingerprint318({
      tenant: c.u.tenantId,
      usuario: c.u.usuarioId,
      profissional: c.profissionalId,
      sid: c.u.sessaoId,
      pr: c.profissionalVersao,
      u: c.usuarioVersao,
      t: c.tenantVersao,
      config: versao,
      credencial: credencialVersao,
      corpus: CORPUS_SINTETICO318,
    });
  }
  async catalogo(u: UsuarioAutenticado) {
    return this.executar(u, async () => ({
      contextoSessao: contextoSessao318(u),
      corpus: CORPUS_SINTETICO318,
      cadastroCredencialPermitido: this.politica.direitos === true,
      chamadaPermitida:
        this.politica.direitos === true && this.politica.modelos.length > 0,
      modelos:
        this.politica.direitos === true
          ? this.politica.modelos.map((m) => ({
              id: m.id,
              nome: m.nome,
              versao: m.versao,
              maxOutputTokens: m.maxOutputTokens,
              precoEntradaMilhaoUsd: m.precoEntradaMilhaoUsd,
              precoSaidaMilhaoUsd: m.precoSaidaMilhaoUsd,
              precoEm: m.precoEm,
              padrao: m.padrao,
            }))
          : [],
      casos: casosSinteticos318.map((c) => ({
        id: c.id,
        titulo: c.titulo,
        geravel: c.geravel,
        criterios: [...c.criterios],
      })),
    }));
  }
  async definirCredencial(
    u: UsuarioAutenticado,
    d: { chave: string; versaoEsperada: number; contextoSessao: string },
  ) {
    if (this.politica.direitos !== true)
      throw new ForbiddenException(
        "Cadastro do piloto aguarda revisão contratual.",
      );
    if (
      Object.keys(d).some(
        (k) => !["chave", "versaoEsperada", "contextoSessao"].includes(k),
      ) ||
      typeof d.chave !== "string" ||
      !d.chave.trim() ||
      d.chave.length > 1024 ||
      /[\s\x00-\x1f\x7f]/.test(d.chave) ||
      !Number.isSafeInteger(d.versaoEsperada) ||
      d.versaoEsperada < 0
    )
      throw new BadRequestException("Confira a credencial e sua versão.");
    return this.executar(u, (c) =>
      this.base.gravarCredencial(
        c,
        d.versaoEsperada,
        d.chave,
        d.contextoSessao,
      ),
    );
  }
  async previa(
    u: UsuarioAutenticado,
    d: { casoId: string; contextoSessao: string },
  ) {
    if (Object.keys(d).some((k) => !["casoId", "contextoSessao"].includes(k)))
      throw new BadRequestException(
        "Somente casos sintéticos do servidor são aceitos.",
      );
    return this.executar(u, async (c, versao) => {
      if (d.contextoSessao !== contextoSessao318(u))
        throw new ConflictException("Contexto da sessão mudou.");
      const caso = casoSintetico318(d.casoId),
        baseline = comporSintetico318(d.casoId),
        cred = await this.base.credencial(c);
      const prova = this.base.conteudo.selar({
        casoId: caso.id,
        nonce: randomUUID(),
        stamp: this.stamp(c, versao, cred?.versao ?? 0),
        corpus: CORPUS_SINTETICO318,
      });
      return {
        casoId: caso.id,
        corpus: CORPUS_SINTETICO318,
        fontes: caso.fontes,
        criterios: caso.criterios,
        baseline,
        prova,
        chamadaPermitida:
          this.politica.direitos === true && this.politica.modelos.length > 0,
      };
    });
  }
  async gerar(
    u: UsuarioAutenticado,
    d: {
      prova: string;
      modeloId: string;
      modalidade: "pre_consulta" | "evolucao";
      aceiteCobranca: boolean;
    },
  ) {
    if (
      Object.keys(d).some(
        (k) =>
          !["prova", "modeloId", "modalidade", "aceiteCobranca"].includes(k),
      ) ||
      !["pre_consulta", "evolucao"].includes(d.modalidade) ||
      d.aceiteCobranca !== true
    )
      throw new BadRequestException(
        "Confira modalidade e cobrança antes de gerar.",
      );
    const p = this.base.conteudo.abrir<ProvaPiloto>(d.prova);
    if (p.corpus !== CORPUS_SINTETICO318)
      throw new ConflictException("Corpus mudou. Confira novamente.");
    const preparado = await this.executar(u, async (c, versao) => {
      if (this.politica.direitos !== true)
        throw new ForbiddenException(
          "Piloto OpenAI aguarda revisão contratual.",
        );
      const modelo = this.politica.modelos.find((m) => m.id === d.modeloId);
      const cred = await this.base.credencial(c);
      if (!modelo || !cred?.chave_criptografada)
        throw new ForbiddenException(
          "Configure chave própria e modelo aprovado.",
        );
      if (p.stamp !== this.stamp(c, versao, cred.versao))
        throw new ConflictException("Contexto mudou. Confira novamente.");
      const fontes = casoSintetico318(p.casoId).fontes;
      comporSintetico318(p.casoId);
      await this.reservar(c, p.nonce);
      await registrarAuditoriaNaTransacao(c.m, {
        tenantId: u.tenantId,
        usuarioId: u.usuarioId,
        acao: "ia318.piloto.geracao.solicitar",
        recursoTipo: "integracao_ia",
      });
      return {
        modelo,
        fontes,
        chave: this.base.conteudo.ler<string>(
          `${u.tenantId}:${c.profissionalId}:${u.usuarioId}:credencial:${cred.versao}`,
          cred.chave_criptografada,
        ),
      };
    });
    // Chamada fora da transacao. Reserva mantida mesmo em falha ou entrega incerta.
    const saida = validarSaida318(
      await this.provider.gerar(
        preparado.chave,
        preparado.modelo.id,
        preparado.fontes,
        d.modalidade,
        "",
        Math.min(preparado.modelo.maxOutputTokens, 2048),
      ),
      preparado.fontes,
    );
    return this.executar(u, async (c, versao) => {
      const cred = await this.base.credencial(c);
      if (
        this.politica.direitos !== true ||
        p.stamp !== this.stamp(c, versao, cred?.versao ?? 0)
      )
        throw new ConflictException("Contexto mudou. Resultado descartado.");
      this.base.conteudo.abrir<ProvaPiloto>(d.prova);
      return {
        casoId: p.casoId,
        corpus: CORPUS_SINTETICO318,
        modeloId: preparado.modelo.id,
        versaoModelo: preparado.modelo.versao,
        itens: saida.itens,
        limitacoes: saida.limitacoes,
        revisaoHumanaObrigatoria: true,
      };
    });
  }
  /** Metadados operacionais apenas; lock transacional da base serializa processos. */
  async reservar(c: Contexto318, nonce: string): Promise<void> {
    const chave = `ia318_piloto_quota:${c.u.usuarioId}`;
    const [row] = await c.m.query(
      "select valor from tenant_configuracoes where tenant_id=$1 and chave=$2 for update",
      [c.u.tenantId, chave],
    );
    const agora = Date.now();
    const ledger: LedgerPiloto = row?.valor ?? { comandos: [], ocupadoAte: 0 };
    if (
      !Array.isArray(ledger.comandos) ||
      ledger.comandos.length > 1000 ||
      !Number.isFinite(ledger.ocupadoAte) ||
      ledger.comandos.some(
        (x) => !x || typeof x.nonce !== "string" || !Number.isFinite(x.em),
      )
    )
      throw new ConflictException("Controle de uso indisponível.");
    ledger.comandos = ledger.comandos.filter((x) => agora - x.em < 86400000);
    if (
      ledger.ocupadoAte > agora ||
      ledger.comandos.some((x) => x.nonce === nonce) ||
      ledger.comandos.filter((x) => agora - x.em < 900000).length >= 5
    )
      throw new ConflictException(
        "Geração já solicitada, em andamento ou limite atingido. Sem repetição automática.",
      );
    ledger.comandos.push({ nonce, em: agora });
    ledger.ocupadoAte = agora + 120000;
    await c.m.query(
      "insert into tenant_configuracoes(tenant_id,chave,valor) values($1,$2,$3) on conflict(tenant_id,chave) do update set valor=excluded.valor",
      [c.u.tenantId, chave, ledger],
    );
  }
}
