"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CredencialIa318 } from "./credencial-ia318";
import {
  FonteIa318,
  ModeloIa318,
  requisitarIa318,
} from "@/lib/rascunhos318-api";
interface Saida {
  itens: { texto: string; refs: string[] }[];
  limitacoes: string[];
}
interface Caso {
  id: string;
  titulo: string;
  geravel: boolean;
  criterios: string[];
}
interface Catalogo {
  contextoSessao: string;
  corpus: string;
  casos: Caso[];
  modelos: ModeloIa318[];
  chamadaPermitida: boolean;
}
interface Previa {
  casoId: string;
  corpus: string;
  fontes: FonteIa318[];
  criterios: string[];
  baseline: Saida;
  prova: string;
  chamadaPermitida: boolean;
}
export function PilotoSintetico318() {
  const [meta, setMeta] = useState<Catalogo | null>(null),
    [caso, setCaso] = useState(""),
    [previa, setPrevia] = useState<Previa | null>(null),
    [saida, setSaida] = useState<Saida | null>(null),
    [modelo, setModelo] = useState(""),
    [modalidade, setModalidade] = useState("pre_consulta"),
    [aceite, setAceite] = useState(false),
    [notas, setNotas] = useState(""),
    [erro, setErro] = useState(""),
    [busy, setBusy] = useState(false);
  const geracao = useRef(0),
    abort = useRef<AbortController | null>(null),
    contexto = useRef<string | null>(null);
  const cancelar = useCallback(() => {
    geracao.current++;
    abort.current?.abort();
    abort.current = null;
  }, []);
  const limpar = useCallback(() => {
    cancelar();
    contexto.current = null;
    setMeta(null);
    setPrevia(null);
    setSaida(null);
    setNotas("");
    setAceite(false);
    setCaso("");
    setModelo("");
    setBusy(false);
    setErro("");
  }, [cancelar]);
  const validarSessao = useCallback(
    async (signal?: AbortSignal) => {
      if (!contexto.current) return false;
      const g = geracao.current;
      try {
        const m = await requisitarIa318<Catalogo>(
          "piloto-catalogo",
          {},
          signal,
        );
        if (signal?.aborted || g !== geracao.current) return false;
        if (m.contextoSessao !== contexto.current) {
          limpar();
          setErro("Sessão mudou. Reabra a revisão.");
          return false;
        }
        return true;
      } catch {
        if (signal?.aborted || g !== geracao.current) return false;
        limpar();
        setErro("Sessão ou liberação indisponível. Reabra a revisão.");
        return false;
      }
    },
    [limpar],
  );
  useEffect(() => {
    const invalidar = () => limpar();
    const ocultar = () => {
      if (document.visibilityState === "hidden") limpar();
    };
    const foco = () => {
      void validarSessao();
    };
    window.addEventListener("focus", foco);
    window.addEventListener("pagehide", invalidar);
    document.addEventListener("visibilitychange", ocultar);
    return () => {
      cancelar();
      window.removeEventListener("focus", foco);
      window.removeEventListener("pagehide", invalidar);
      document.removeEventListener("visibilitychange", ocultar);
    };
  }, [cancelar, limpar, validarSessao]);
  async function acao(fn: (signal: AbortSignal) => Promise<void>) {
    cancelar();
    const g = geracao.current;
    const c = new AbortController();
    abort.current = c;
    setErro("");
    setBusy(true);
    try {
      await fn(c.signal);
    } catch (e) {
      if (g === geracao.current && !c.signal.aborted) {
        setErro(e instanceof Error ? e.message : "Revisão indisponível.");
        setPrevia(null);
        setSaida(null);
        setNotas("");
      }
    } finally {
      if (g === geracao.current && !c.signal.aborted) setBusy(false);
    }
  }
  async function abrir() {
    await acao(async (signal) => {
      const m = await requisitarIa318<Catalogo>("piloto-catalogo", {}, signal);
      if (signal.aborted) return;
      contexto.current = m.contextoSessao;
      setMeta(m);
      setModelo(m.modelos.find((x) => x.padrao)?.id ?? m.modelos[0]?.id ?? "");
    });
  }
  async function conferir() {
    setSaida(null);
    setNotas("");
    setAceite(false);
    await acao(async (signal) => {
      const m = await requisitarIa318<Catalogo>("piloto-catalogo", {}, signal);
      if (signal.aborted) return;
      if (m.contextoSessao !== contexto.current) {
        limpar();
        throw new Error("Sessão mudou. Reabra a revisão.");
      }
      const p = await requisitarIa318<Previa>(
        "piloto-previa",
        { casoId: caso, contextoSessao: m.contextoSessao },
        signal,
      );
      if (!signal.aborted && (await validarSessao(signal))) setPrevia(p);
    });
  }
  async function gerar() {
    if (!previa || !meta?.chamadaPermitida || !aceite || !modelo || busy)
      return;
    await acao(async (signal) => {
      const m = await requisitarIa318<Catalogo>("piloto-catalogo", {}, signal);
      if (signal.aborted) return;
      if (m.contextoSessao !== contexto.current) {
        limpar();
        throw new Error("Sessão mudou. Reabra a revisão.");
      }
      const r = await requisitarIa318<Saida>(
        "piloto-gerar",
        {
          prova: previa.prova,
          modeloId: modelo,
          modalidade,
          aceiteCobranca: true,
        },
        signal,
      );
      if (!signal.aborted && (await validarSessao(signal))) setSaida(r);
    });
  }
  function selecionar(id: string) {
    cancelar();
    setBusy(false);
    setCaso(id);
    setPrevia(null);
    setSaida(null);
    setNotas("");
    setAceite(false);
    setErro("");
  }
  const atual = meta?.casos.find((c) => c.id === caso),
    escolhido = meta?.modelos.find((m) => m.id === modelo);
  const resultado = (v: Saida) => (
    <>
      <ul className="list-disc pl-5">
        {v.itens.map((i, n) => (
          <li key={n} className="whitespace-pre-wrap break-words">
            {i.texto}{" "}
            <span className="text-sm">Fontes: {i.refs.join(", ")}</span>
          </li>
        ))}
      </ul>
      <ul>
        {v.limitacoes.map((l, n) => (
          <li key={n}>{l}</li>
        ))}
      </ul>
    </>
  );
  return (
    <section
      className="grid gap-4 rounded-md border border-linha bg-white p-4"
      aria-labelledby="piloto-sintetico318"
    >
      <h2 id="piloto-sintetico318" className="font-semibold">
        Revisão sintética da assistência
      </h2>
      <p>
        Área de teste com casos inventados fornecidos pelo servidor. Sem acesso
        a pacientes e sem salvar no prontuário. A revisão humana não libera o
        uso clínico automaticamente.
      </p>
      {!meta && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void abrir()}
          className="rounded border p-2"
        >
          Abrir revisão sintética
        </button>
      )}
      {erro && <p role="alert">{erro}</p>}
      {busy && <p role="status">Carregando revisão sintética…</p>}
      {meta && (
        <>
          <p>
            Corpus: {meta.corpus}. Fontes e saídas permanecem somente nesta
            tela.
          </p>
          <label className="grid gap-1">
            Caso sintético
            <select
              value={caso}
              onChange={(e) => selecionar(e.target.value)}
              disabled={busy}
              className="rounded border p-2"
            >
              <option value="">Escolha um caso</option>
              {meta.casos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.titulo}
                  {c.geravel ? "" : " (teste de contrato)"}
                </option>
              ))}
            </select>
          </label>
          {atual && (
            <ul className="list-disc pl-5">
              {atual.criterios.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          )}
          {atual && !atual.geravel && (
            <p>
              Este cenário é verificado pelos testes de contrato e segurança.
              Não produz chamada ao fornecedor.
            </p>
          )}
          <button
            type="button"
            disabled={busy || !atual?.geravel}
            onClick={() => void conferir()}
            className="rounded border p-2"
          >
            Conferir fontes e composição local
          </button>
          {previa && (
            <>
              <div>
                <h3 className="font-semibold">Fontes sintéticas</h3>
                <ul>
                  {previa.fontes.map((f) => (
                    <li key={f.ref} className="whitespace-pre-wrap break-words">
                      {f.ref} · {f.data}: {f.texto}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold">Composição factual local</h3>
                {resultado(previa.baseline)}
              </div>
              {!meta.chamadaPermitida && (
                <p>OpenAI aguarda revisão contratual e catálogo aprovado.</p>
              )}
              <label className="grid gap-1">
                Modelo OpenAI
                <select
                  value={modelo}
                  disabled={busy || !meta.chamadaPermitida}
                  onChange={(e) => {
                    setModelo(e.target.value);
                    setSaida(null);
                    setAceite(false);
                  }}
                  className="rounded border p-2"
                >
                  <option value="">Sem modelo aprovado</option>
                  {meta.modelos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nome} ({m.versao})
                    </option>
                  ))}
                </select>
              </label>
              {escolhido && (
                <p>
                  Preço de {escolhido.precoEm}: US${" "}
                  {escolhido.precoEntradaMilhaoUsd}/milhão de tokens de entrada
                  e US$ {escolhido.precoSaidaMilhaoUsd}/milhão de saída. Até{" "}
                  {escolhido.maxOutputTokens} tokens de saída. A cobrança
                  efetiva é da OpenAI; estimativas não são teto garantido.
                </p>
              )}
              <label className="grid gap-1">
                Tipo de rascunho
                <select
                  value={modalidade}
                  onChange={(e) => setModalidade(e.target.value)}
                  disabled={busy}
                  className="rounded border p-2"
                >
                  <option value="pre_consulta">Pré-consulta</option>
                  <option value="evolucao">Evolução</option>
                </select>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={aceite}
                  onChange={(e) => setAceite(e.target.checked)}
                  disabled={busy || !meta.chamadaPermitida}
                />{" "}
                Entendo que a chamada usa minha chave e pode ser cobrada na
                minha conta OpenAI.
              </label>
              <p>
                Até 5 chamadas em 15 minutos, intervalo mínimo de 2 minutos. Sem
                repetição automática após erro ou entrega incerta.
              </p>
              <button
                type="button"
                disabled={
                  busy ||
                  !meta.chamadaPermitida ||
                  !modelo ||
                  !aceite ||
                  !!saida
                }
                onClick={() => void gerar()}
                className="rounded border p-2"
              >
                Gerar comparação OpenAI
              </button>
              {saida && (
                <div>
                  <h3 className="font-semibold">
                    Rascunho OpenAI para conferência
                  </h3>
                  {resultado(saida)}
                </div>
              )}
              <label className="grid gap-1">
                Notas da revisão sintética
                <textarea
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  maxLength={3000}
                  className="rounded border p-2"
                  aria-describedby="notas-piloto318"
                />
              </label>
              <p id="notas-piloto318">
                Confira fatos, datas, unidades, negações, omissões e afirmações
                sem suporte. Use somente informações sintéticas. Estas notas não
                são enviadas ao fornecedor nem armazenadas.
              </p>
            </>
          )}
          <CredencialIa318 piloto />
          <button type="button" onClick={limpar} className="rounded border p-2">
            Fechar e limpar revisão
          </button>
        </>
      )}
    </section>
  );
}
