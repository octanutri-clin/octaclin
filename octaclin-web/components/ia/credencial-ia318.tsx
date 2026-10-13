"use client";
import { useEffect, useState, useRef } from "react";
import { requisitarIa318 } from "@/lib/rascunhos318-api";
export function CredencialIa318() {
  const [estado, setEstado] = useState<{
      estado: string;
      versao: number;
    } | null>(null),
    [chave, setChave] = useState(""),
    [mensagem, setMensagem] = useState(""),
    [busy, setBusy] = useState(false);
  const contexto = useRef<string | null>(null);
  useEffect(() => {
    const c = new AbortController();
    void Promise.all([
      requisitarIa318<{ contextoSessao: string }>("modelos", {}, c.signal),
      requisitarIa318<{ estado: string; versao: number }>(
        "credencial",
        {},
        c.signal,
      ),
    ])
      .then(([meta, estado]) => {
        if (!c.signal.aborted) {
          contexto.current = meta.contextoSessao;
          setEstado(estado);
        }
      })
      .catch(() => {
        if (!c.signal.aborted)
          setMensagem(
            "Configuração disponível somente ao profissional com permissão.",
          );
      });
    return () => c.abort();
  }, []);
  async function alterar(remover = false) {
    if (!estado || busy) return;
    setBusy(true);
    const valor = chave;
    setChave("");
    try {
      const meta = await requisitarIa318<{ contextoSessao: string }>("modelos");
      if (!meta.contextoSessao || meta.contextoSessao !== contexto.current) {
        setEstado(null);
        setMensagem("Sessão mudou. Reabra as integrações.");
        return;
      }
      setEstado(
        await requisitarIa318(
          remover ? "remover-credencial" : "definir-credencial",
          {
            versaoEsperada: estado.versao,
            contextoSessao: contexto.current,
            ...(remover ? {} : { chave: valor }),
          },
        ),
      );
      setMensagem(
        remover
          ? "Credencial removida do OctaClin. Revogue também no fornecedor, se necessário."
          : "Credencial cadastrada. A disponibilidade da função depende das liberações.",
      );
    } catch (e) {
      setMensagem(
        e instanceof Error ? e.message : "Não foi possível concluir.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="grid gap-3 rounded-md border border-linha bg-white p-4"
      aria-labelledby="credencial-ia318"
    >
      <h2 id="credencial-ia318" className="font-semibold">
        Assistência OpenAI com chave própria
      </h2>
      <p>
        Uso e cobrança na sua conta OpenAI. Rascunhos exigem revisão
        profissional. Não cadastre chaves compartilhadas.
      </p>
      <p>Estado: {estado?.estado ?? "indisponível"}</p>
      <label>
        Chave API individual
        <input
          className="block w-full rounded border p-2"
          type="password"
          autoComplete="off"
          value={chave}
          maxLength={1024}
          onChange={(e) => setChave(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          className="rounded border p-2"
          disabled={busy || !estado || !chave.trim()}
          onClick={() => void alterar()}
        >
          Cadastrar ou substituir chave
        </button>
        <button
          className="rounded border p-2"
          disabled={busy || !estado || estado.estado === "ausente"}
          onClick={() => void alterar(true)}
        >
          Remover credencial
        </button>
      </div>
      <p role="status">{mensagem}</p>
      <p className="text-sm">
        A função aguarda validação clínica e contratual. O cadastro também pode
        permanecer bloqueado. Remover aqui não revoga a chave na OpenAI.
      </p>
    </section>
  );
}
