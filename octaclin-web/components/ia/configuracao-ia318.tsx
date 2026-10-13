"use client";
import { useEffect, useState, useRef } from "react";
import { requisitarIa318, type ConfigIa318 } from "@/lib/rascunhos318-api";
export function ConfiguracaoIa318() {
  const [c, setC] = useState<ConfigIa318 | null>(null),
    [mensagem, setMensagem] = useState(""),
    [busy, setBusy] = useState(false);
  const contexto = useRef<string | null>(null);
  const invalida = useRef(false);
  useEffect(() => {
    const a = new AbortController();
    void requisitarIa318<ConfigIa318>("configuracao", {}, a.signal)
      .then((v) => {
        if (!a.signal.aborted && !invalida.current) {
          contexto.current = v.contextoSessao ?? null;
          setC(v);
        }
      })
      .catch(() => {
        if (!a.signal.aborted) setMensagem("Configuração indisponível.");
      });
    const conferir = async () => {
      try {
        const v = await requisitarIa318<ConfigIa318>(
          "configuracao",
          {},
          a.signal,
        );
        if (contexto.current && v.contextoSessao !== contexto.current) {
          invalida.current = true;
          setC(null);
          setMensagem("Sessão mudou. Reabra as configurações.");
        }
      } catch {
        if (!a.signal.aborted) {
          invalida.current = true;
          setC(null);
        }
      }
    };
    window.addEventListener("focus", conferir);
    return () => {
      a.abort();
      window.removeEventListener("focus", conferir);
    };
  }, []);
  async function salvar() {
    if (!c || busy) return;
    setBusy(true);
    try {
      const atualizada = await requisitarIa318<ConfigIa318>("configurar", {
        contextoSessao: c.contextoSessao,
        habilitada: c.habilitada,
        versaoEsperada: c.versao,
        maxChamadas15min: c.maxChamadas15min,
        maxTokensSaida: c.maxTokensSaida,
      });
      if (!invalida.current && atualizada.contextoSessao === contexto.current) {
        setC(atualizada);
        setMensagem("Configuração salva.");
      } else {
        invalida.current = true;
        setC(null);
        setMensagem("Sessão mudou. Reabra as configurações.");
      }
    } catch (e) {
      setMensagem(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="grid gap-3 rounded-md border border-linha bg-white p-4">
      <h2 className="font-semibold">Disponibilidade da assistência OpenAI</h2>
      <p>
        A clínica permite a integração; cada profissional utiliza somente sua
        chave. O consumo é cobrado na conta do profissional.
      </p>
      {c ? (
        <>
          <p>
            {c.operacaoAprovada
              ? "Liberação operacional disponível."
              : "Validação clínica e contratual pendente. Habilitação bloqueada."}
          </p>
          <label>
            <input
              type="checkbox"
              checked={c.habilitada}
              disabled={busy || !c.operacaoAprovada}
              onChange={(e) => setC({ ...c, habilitada: e.target.checked })}
            />{" "}
            Permitir geração de rascunhos na clínica
          </label>
          <label>
            Chamadas por profissional a cada 15 minutos (1–5)
            <input
              className="block rounded border p-2"
              type="number"
              min={1}
              max={5}
              value={c.maxChamadas15min}
              onChange={(e) =>
                setC({ ...c, maxChamadas15min: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Limite de tokens de saída (256–2048)
            <input
              className="block rounded border p-2"
              type="number"
              min={256}
              max={2048}
              value={c.maxTokensSaida}
              onChange={(e) =>
                setC({ ...c, maxTokensSaida: Number(e.target.value) })
              }
            />
          </label>
          <button
            className="rounded border p-2"
            disabled={busy}
            onClick={() => void salvar()}
          >
            Salvar disponibilidade e limites
          </button>
        </>
      ) : null}
      <p role="status">{mensagem}</p>
    </section>
  );
}
