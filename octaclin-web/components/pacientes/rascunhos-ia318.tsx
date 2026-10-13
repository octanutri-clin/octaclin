"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  requisitarIa318,
  type FonteIa318,
  type ModeloIa318,
  type PreviaIa318,
  type ConfigIa318,
} from "@/lib/rascunhos318-api";
function ConteudoRascunhosIa318({
  pacienteId,
  aoConfirmar,
}: {
  pacienteId: string;
  aoConfirmar: () => void;
}) {
  const [modelos, setModelos] = useState<ModeloIa318[]>([]),
    [config, setConfig] = useState<ConfigIa318 | null>(null),
    [fontes, setFontes] = useState<FonteIa318[]>([]),
    [selecoes, setSelecoes] = useState<string[]>([]),
    [modelo, setModelo] = useState(""),
    [modalidade, setModalidade] = useState<"pre-consulta" | "evolucao">(
      "pre-consulta",
    ),
    [nota, setNota] = useState(""),
    [previa, setPrevia] = useState<PreviaIa318 | null>(null),
    [texto, setTexto] = useState(""),
    [titulo, setTitulo] = useState(""),
    [aceite, setAceite] = useState(false),
    [busy, setBusy] = useState(false),
    [mensagem, setMensagem] = useState("");
  const epoch = useRef(0),
    controller = useRef<AbortController | null>(null),
    confirmacao = useRef<string | null>(null),
    contextoSessao = useRef<string | null>(null);
  const limparSessao = useCallback(() => {
    epoch.current++;
    controller.current?.abort();
    setPrevia(null);
    setTexto("");
    setNota("");
    setTitulo("");
    setAceite(false);
    setFontes([]);
    setSelecoes([]);
    setModelos([]);
    setConfig(null);
    setBusy(false);
    confirmacao.current = null;
    setMensagem("Contexto da sessão mudou. Reabra o prontuário.");
  }, []);
  const verificarSessao = useCallback(async () => {
    try {
      const r = await requisitarIa318<{ contextoSessao: string }>("modelos");
      if (!r.contextoSessao || r.contextoSessao !== contextoSessao.current) {
        limparSessao();
        return false;
      }
      return true;
    } catch {
      limparSessao();
      return false;
    }
  }, [limparSessao]);
  useEffect(() => {
    const c = new AbortController();
    controller.current = c;
    const n = ++epoch.current;
    void requisitarIa318<{
      contextoSessao: string;
      modelos: ModeloIa318[];
      configuracao: ConfigIa318;
    }>("modelos", {}, c.signal)
      .then(async (r) => {
        if (epoch.current !== n || c.signal.aborted) return;
        contextoSessao.current = r.contextoSessao;
        setConfig(r.configuracao);
        setModelos(r.modelos);
        setModelo(
          r.modelos.find((m) => m.padrao)?.id ?? r.modelos[0]?.id ?? "",
        );
        if (r.configuracao.habilitada && r.configuracao.operacaoAprovada) {
          const f = await requisitarIa318<{
            fontes: FonteIa318[];
          }>("fontes", { pacienteId }, c.signal);
          if (epoch.current === n && !c.signal.aborted) setFontes(f.fontes);
        }
      })
      .catch(() => {
        if (epoch.current === n && !c.signal.aborted)
          setMensagem("Assistência indisponível. Use o registro manual.");
      });
    return () => {
      epoch.current = n + 1;
      c.abort();
      controller.current?.abort();
    };
  }, [pacienteId]);
  useEffect(() => {
    const foco = () => {
      if (contextoSessao.current) void verificarSessao();
    };
    window.addEventListener("focus", foco);
    return () => window.removeEventListener("focus", foco);
  }, [verificarSessao]);
  function descartar() {
    epoch.current++;
    controller.current?.abort();
    setPrevia(null);
    setTexto("");
    setNota("");
    setTitulo("");
    setAceite(false);
    setBusy(false);
    confirmacao.current = null;
  }
  async function gerar() {
    if (busy) return;
    const n = ++epoch.current,
      c = new AbortController();
    controller.current?.abort();
    controller.current = c;
    setBusy(true);
    setPrevia(null);
    setAceite(false);
    setMensagem("");
    confirmacao.current = null;
    try {
      if (!(await verificarSessao()) || epoch.current !== n || c.signal.aborted)
        return;
      const r = await requisitarIa318<PreviaIa318>(
        modalidade,
        {
          pacienteId,
          chaveComando: crypto.randomUUID(),
          modeloId: modelo,
          selecoes: selecoes.map((ref) => {
            const i = ref.indexOf(":");
            return { tipo: ref.slice(0, i), id: ref.slice(i + 1) };
          }),
          ...(modalidade === "evolucao" ? { textoProfissional: nota } : {}),
        },
        c.signal,
      );
      if (!(await verificarSessao())) return;
      if (epoch.current === n && !c.signal.aborted) {
        setPrevia(r);
        setTexto(r.texto);
      }
    } catch (e) {
      if (epoch.current === n && !c.signal.aborted)
        setMensagem(e instanceof Error ? e.message : "Não foi possível gerar.");
    } finally {
      if (epoch.current === n) setBusy(false);
    }
  }
  async function confirmar() {
    if (!previa || !aceite || busy) return;
    const n = epoch.current,
      c = new AbortController();
    controller.current = c;
    setBusy(true);
    confirmacao.current ??= crypto.randomUUID();
    try {
      await requisitarIa318(
        "confirmar",
        {
          pacienteId,
          chaveComando: confirmacao.current,
          provaRevisao: previa.provaRevisao,
          titulo,
          conteudo: texto,
          textoProfissional: nota,
          tipo: "observacao",
          confirmado: true,
        },
        c.signal,
      );
      if (epoch.current === n && !c.signal.aborted) {
        descartar();
        setMensagem("Evolução privada registrada após sua revisão.");
        aoConfirmar();
      }
    } catch (e) {
      if (epoch.current === n && !c.signal.aborted)
        setMensagem(
          e instanceof Error
            ? e.message
            : "Confirmação não recebida. Confira o histórico antes de tentar novamente.",
        );
    } finally {
      if (epoch.current === n) setBusy(false);
    }
  }
  const caracteresSelecionados =
    fontes
      .filter((f) => selecoes.includes(f.ref))
      .reduce((n, f) => n + [...f.texto].length, 0) + [...nota].length;
  const m = modelos.find((m) => m.id === modelo),
    disponivel =
      config?.habilitada && config.operacaoAprovada && modelos.length > 0;
  return (
    <section
      className="grid gap-3 rounded-md border border-linha bg-white p-4"
      aria-labelledby="ia318-heading"
    >
      <h2 id="ia318-heading" className="font-semibold">
        Assistência para pré-consulta e evolução
      </h2>
      <p>
        Confira cada fato, data, unidade e negação. A ferramenta não fornece
        diagnóstico, tratamento ou recomendações.
      </p>
      {!disponivel ? (
        <p>
          Função aguarda validação e liberação. O registro manual permanece
          disponível.
        </p>
      ) : (
        <>
          <p>
            Contexto: até 3 evoluções e 3 medidas recentes. Exames, planos e
            conteúdo de mensagens não incluídos. Selecione somente o necessário;
            o conteúdo escolhido será enviado à OpenAI.
          </p>
          <label>
            Finalidade
            <select
              className="block rounded border p-2"
              value={modalidade}
              disabled={busy}
              onChange={(e) => {
                descartar();
                setModalidade(e.target.value as typeof modalidade);
              }}
            >
              <option value="pre-consulta">Síntese de pré-consulta</option>
              <option value="evolucao">Rascunho de evolução</option>
            </select>
          </label>
          <label>
            Modelo
            <select
              className="block rounded border p-2"
              value={modelo}
              disabled={busy}
              onChange={(e) => {
                descartar();
                setModelo(e.target.value);
              }}
            >
              {modelos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
          {m ? (
            <p className="text-sm">
              Tarifa de referência em {m.precoEm}: US$ {m.precoEntradaMilhaoUsd}
              /milhão de tokens de entrada e US$ {m.precoSaidaMilhaoUsd}/milhão
              de saída. Até{" "}
              {Math.min(m.maxOutputTokens, config?.maxTokensSaida ?? 2048)}{" "}
              tokens de saída; até {config?.maxChamadas15min} solicitações/15
              min. Tokens internos e cobrança efetiva são definidos pelo
              fornecedor.
            </p>
          ) : null}
          <fieldset className="grid gap-2">
            <legend>Prévia das fontes — seleção explícita</legend>
            <p>
              Contexto selecionado: {caracteresSelecionados}/12000 caracteres.
              Não há corte automático das fontes.
            </p>
            {fontes.map((f) => (
              <label key={f.ref} className="rounded border p-2">
                <input
                  type="checkbox"
                  checked={selecoes.includes(f.ref)}
                  disabled={busy || !!previa}
                  onChange={(e) =>
                    setSelecoes((v) =>
                      e.target.checked
                        ? [...v, f.ref]
                        : v.filter((x) => x !== f.ref),
                    )
                  }
                />{" "}
                {f.tipo} — {f.data}
                <span className="block whitespace-pre-wrap">{f.texto}</span>
              </label>
            ))}
          </fieldset>
          {modalidade === "evolucao" ? (
            <label>
              Notas desta consulta (sem identificadores desnecessários)
              <textarea
                className="block w-full rounded border p-2"
                maxLength={6000}
                value={nota}
                disabled={busy || !!previa}
                onChange={(e) => setNota(e.target.value)}
              />
            </label>
          ) : null}
          <button
            className="rounded border p-2"
            disabled={
              busy ||
              caracteresSelecionados > 12000 ||
              (!selecoes.length && !nota.trim())
            }
            onClick={() => void gerar()}
          >
            Gerar rascunho com as fontes selecionadas
          </button>
        </>
      )}
      {previa ? (
        <>
          <h3 className="font-semibold">Prévia para revisão</h3>
          <p>
            Modelo {previa.modeloId} ({previa.versaoModelo}). Válida até{" "}
            {previa.expiraEm}. O texto não confirmado será descartado ao sair.
          </p>
          <ul>
            {previa.itens.map((i, n) => (
              <li key={n} className="whitespace-pre-wrap">
                {i.texto} — fontes: {i.refs.join(", ")}
              </li>
            ))}
          </ul>
          <ul>
            {previa.referencias.map((r) => (
              <li key={r.ref}>
                {r.ref}: {r.tipo}, {r.data}
              </li>
            ))}
          </ul>
          <ul>
            {previa.limitacoes.map((l, n) => (
              <li key={n}>{l}</li>
            ))}
          </ul>
          {previa.modalidade === "evolucao" ? (
            <>
              <label>
                Título para registrar o rascunho
                <input
                  className="block w-full rounded border p-2"
                  value={titulo}
                  maxLength={180}
                  disabled={busy}
                  onChange={(e) => {
                    confirmacao.current = null;
                    setTitulo(e.target.value);
                  }}
                />
              </label>
              <label>
                Texto revisado
                <textarea
                  className="block w-full rounded border p-2"
                  value={texto}
                  maxLength={6000}
                  disabled={busy}
                  onChange={(e) => {
                    confirmacao.current = null;
                    setTexto(e.target.value);
                    setAceite(false);
                  }}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={aceite}
                  disabled={busy}
                  onChange={(e) => setAceite(e.target.checked)}
                />{" "}
                Conferi e assumo o conteúdo desta evolução.
              </label>
              <button
                className="rounded border p-2"
                disabled={
                  busy || !aceite || !titulo.trim() || texto.trim().length < 3
                }
                onClick={() => void confirmar()}
              >
                Confirmar evolução privada
              </button>
            </>
          ) : null}
          <button className="rounded border p-2" onClick={descartar}>
            Descartar rascunho
          </button>
        </>
      ) : null}
      <p role="status">
        {busy ? "Processando, sem repetição automática." : mensagem}
      </p>
    </section>
  );
}
export function RascunhosIa318(props: {
  pacienteId: string;
  aoConfirmar: () => void;
}) {
  return <ConteudoRascunhosIa318 key={props.pacienteId} {...props} />;
}
