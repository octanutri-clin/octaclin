'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Send, UploadCloud } from 'lucide-react';
import {
  carregarFormularioPublico,
  enviarFormularioPublico,
  salvarRascunhoFormularioPublico,
  solicitarUploadFormularioPublico,
  confirmarUploadFormularioPublico,
  FormularioPublico,
  PerguntaFormularioPublico
} from '@/lib/formularios-publicos-api';
import { Botao } from '@/components/ui/botao';
import { Campo } from '@/components/ui/campo';

interface Props {
  token: string;
}

type ValorResposta = string | number | boolean | string[];

function numero(configuracao: Record<string, unknown>, chave: string, padrao: number) {
  const valor = Number(configuracao[chave]);
  return Number.isFinite(valor) ? valor : padrao;
}

function texto(configuracao: Record<string, unknown>, chave: string, padrao = '') {
  const valor = configuracao[chave];
  return typeof valor === 'string' ? valor : padrao;
}

function secaoPergunta(pergunta: PerguntaFormularioPublico) {
  return texto(pergunta.configuracao, 'secao', 'Sem secao');
}

function valorPreenchido(valor: ValorResposta | undefined) {
  if (valor === undefined) return false;
  if (typeof valor === 'string') return valor.trim().length > 0;
  if (Array.isArray(valor)) return valor.length > 0;
  return true;
}

function formatarExpiracao(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(data);
}

export function FormularioPacientePublico({ token }: Props) {
  const [formulario, setFormulario] = useState<FormularioPublico | null>(null);
  const [respostas, setRespostas] = useState<Record<string, ValorResposta>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [estadoRascunho, setEstadoRascunho] = useState<'inativo' | 'salvando' | 'salvo' | 'erro'>('inativo');
  const [houveEdicao, setHouveEdicao] = useState(false);
  const versaoRascunhoRef = useRef(0);
  const pendenteRascunhoRef = useRef<{ perguntaId: string; valor: unknown }[] | null>(null);
  const salvamentoRascunhoRef = useRef<Promise<void> | null>(null);
  const suspenderRascunhoRef = useRef(false);

  useEffect(() => {
    setCarregando(true);
    carregarFormularioPublico(token)
      .then((resposta) => {
        setFormulario(resposta);
        setRespostas(Object.fromEntries((resposta.respostasRascunho ?? []).map((item) => [item.perguntaId, item.valor as ValorResposta])));
        versaoRascunhoRef.current = resposta.rascunhoVersao ?? 0;
        setEstadoRascunho(resposta.respostasRascunho?.length ? 'salvo' : 'inativo');
        setHouveEdicao(false);
        setErro(null);
      })
      .catch((erroAtual) => setErro(erroAtual instanceof Error ? erroAtual.message : 'Formulario indisponivel.'))
      .finally(() => setCarregando(false));
  }, [token]);

  const secoes = useMemo(() => {
    const grupos: { nome: string; perguntas: PerguntaFormularioPublico[] }[] = [];
    for (const pergunta of formulario?.perguntas ?? []) {
      const nome = secaoPergunta(pergunta);
      const grupo = grupos.find((item) => item.nome === nome);
      if (grupo) grupo.perguntas.push(pergunta);
      else grupos.push({ nome, perguntas: [pergunta] });
    }
    return grupos;
  }, [formulario]);

  const perguntasObrigatorias = formulario?.perguntas.filter((pergunta) => pergunta.obrigatoria) ?? [];
  const obrigatoriasRespondidas = perguntasObrigatorias.filter((pergunta) => valorPreenchido(respostas[pergunta.id])).length;

  const montarRespostas = useCallback((valores: Record<string, ValorResposta>) => (
    (formulario?.perguntas ?? [])
      .filter((pergunta) => valorPreenchido(valores[pergunta.id]))
      .map((pergunta) => ({ perguntaId: pergunta.id, valor: valores[pergunta.id] }))
  ), [formulario]);

  const enfileirarRascunho = useCallback((respostasAtuais: { perguntaId: string; valor: unknown }[]) => {
    pendenteRascunhoRef.current = respostasAtuais;
    if (salvamentoRascunhoRef.current) return salvamentoRascunhoRef.current;

    const executar = async () => {
      while (pendenteRascunhoRef.current && !suspenderRascunhoRef.current) {
        const proximo = pendenteRascunhoRef.current;
        pendenteRascunhoRef.current = null;
        setEstadoRascunho('salvando');
        try {
          const salvo = await salvarRascunhoFormularioPublico(token, versaoRascunhoRef.current, proximo);
          versaoRascunhoRef.current = salvo.rascunhoVersao;
          setEstadoRascunho('salvo');
        } catch (erroAtual) {
          pendenteRascunhoRef.current = null;
          setEstadoRascunho('erro');
          setErro(erroAtual instanceof Error ? erroAtual.message : 'Nao foi possivel salvar o rascunho.');
        }
      }
    };

    const promessa = executar().finally(() => {
      salvamentoRascunhoRef.current = null;
    });
    salvamentoRascunhoRef.current = promessa;
    return promessa;
  }, [token]);

  useEffect(() => {
    if (!formulario || !houveEdicao || enviado || suspenderRascunhoRef.current) return;
    const temporizador = window.setTimeout(() => {
      void enfileirarRascunho(montarRespostas(respostas));
    }, 800);
    return () => window.clearTimeout(temporizador);
  }, [enfileirarRascunho, enviado, formulario, houveEdicao, montarRespostas, respostas]);

  function atualizarResposta(perguntaId: string, valor: ValorResposta) {
    setRespostas((atuais) => ({ ...atuais, [perguntaId]: valor }));
    setHouveEdicao(true);
    setEstadoRascunho('inativo');
  }

  function alternarCheckbox(perguntaId: string, valor: string) {
    const atuais = Array.isArray(respostas[perguntaId]) ? (respostas[perguntaId] as string[]) : [];
    atualizarResposta(perguntaId, atuais.includes(valor) ? atuais.filter((item) => item !== valor) : [...atuais, valor]);
  }

  async function enviarArquivos(pergunta: PerguntaFormularioPublico, arquivos: File[]): Promise<string[]> {
    const ids: string[] = [];
    for (const arquivo of arquivos) {
      const solicitacao = await solicitarUploadFormularioPublico(token, {
        perguntaId: pergunta.id,
        nomeArquivo: arquivo.name,
        mimeType: arquivo.type,
        tamanhoBytes: arquivo.size
      });
      const envio = await fetch(solicitacao.uploadUrl, {
        method: 'PUT',
        headers: solicitacao.uploadHeaders,
        body: arquivo
      });
      if (!envio.ok) throw new Error('Nao foi possivel armazenar o arquivo.');
      const confirmado = await confirmarUploadFormularioPublico(token, solicitacao.arquivo.id, pergunta.id);
      ids.push(confirmado.id);
    }
    return ids;
  }

  async function enviar() {
    if (!formulario) return;

    const obrigatoriaPendente = formulario.perguntas.find((pergunta) => pergunta.obrigatoria && !valorPreenchido(respostas[pergunta.id]));
    if (obrigatoriaPendente) {
      setErro(`Responda a pergunta obrigatoria: ${obrigatoriaPendente.enunciado}`);
      return;
    }

    setSalvando(true);
    setErro(null);
    try {
      await enfileirarRascunho(montarRespostas(respostas));
      suspenderRascunhoRef.current = true;
      await enviarFormularioPublico(
        token,
        montarRespostas(respostas)
      );
      setEnviado(true);
    } catch (erroAtual) {
      suspenderRascunhoRef.current = false;
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Nao foi possivel enviar as respostas.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-fundo px-4 text-sm text-texto-suave">
        Carregando formulario...
      </main>
    );
  }

  if (enviado) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-fundo px-4">
        <section className="grid w-full max-w-xl gap-3 border border-linha bg-white p-6 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-sucesso-forte" />
          <h1 className="text-xl font-semibold text-tinta">Respostas enviadas</h1>
          <p className="text-sm text-texto-suave">Seu formulario foi registrado com sucesso.</p>
        </section>
      </main>
    );
  }

  if (!formulario) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-fundo px-4">
        <section className="flex w-full max-w-xl items-start gap-3 border border-perigo-borda bg-perigo-suave p-4 text-sm text-perigo">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{erro ?? 'Formulario indisponivel.'}</span>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-fundo px-4 py-6 text-tinta">
      <section className="mx-auto grid w-full max-w-3xl gap-4">
        <header className="border border-linha bg-white p-5">
          <p className="text-xs font-semibold uppercase text-texto-suave">OctaClin</p>
          <h1 className="mt-1 text-2xl font-semibold">{formulario.titulo}</h1>
          {formulario.descricao ? <p className="mt-2 text-sm text-texto-suave">{formulario.descricao}</p> : null}
          {formulario.expiraEm && formatarExpiracao(formulario.expiraEm) ? (
            <p className="mt-3 text-sm text-texto-suave">Disponivel ate {formatarExpiracao(formulario.expiraEm)}.</p>
          ) : null}
          {perguntasObrigatorias.length ? (
            <div className="mt-4 grid gap-2" aria-label="Progresso do formulario">
              <div className="flex items-center justify-between gap-3 text-xs font-medium text-texto-suave">
                <span>Progresso</span>
                <span>{obrigatoriasRespondidas} de {perguntasObrigatorias.length} obrigatorias respondidas</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-superficie" role="progressbar" aria-valuemin={0} aria-valuemax={perguntasObrigatorias.length} aria-valuenow={obrigatoriasRespondidas}>
                <div className="h-full bg-primaria transition-[width]" style={{ width: `${(obrigatoriasRespondidas / perguntasObrigatorias.length) * 100}%` }} />
              </div>
            </div>
          ) : null}
          {estadoRascunho !== 'inativo' ? (
            <p className="mt-3 text-xs text-texto-suave" aria-live="polite">
              {estadoRascunho === 'salvando'
                ? 'Salvando rascunho'
                : estadoRascunho === 'salvo'
                  ? 'Rascunho salvo'
                  : 'Falha ao salvar rascunho'}
            </p>
          ) : null}
        </header>

        {erro ? (
          <div className="flex items-center gap-2 border border-perigo-borda bg-perigo-suave px-4 py-3 text-sm text-perigo" role="alert">
            <AlertTriangle className="h-4 w-4" />
            <span>{erro} Revise e tente enviar novamente.</span>
          </div>
        ) : null}

        <section className="grid gap-4 border border-linha bg-white p-5">
          {secoes.map((secao) => (
            <div key={secao.nome} className="grid gap-3">
              <div className="border-b border-linha pb-2">
                <h2 className="text-sm font-semibold">{secao.nome}</h2>
              </div>
              {secao.perguntas.map((pergunta) => (
                <CampoPergunta
                  key={pergunta.id}
                  pergunta={pergunta}
                  valor={respostas[pergunta.id]}
                  aoAlterar={(valor) => atualizarResposta(pergunta.id, valor)}
                  aoAlternarCheckbox={(valor) => alternarCheckbox(pergunta.id, valor)}
                  aoEnviarArquivos={(arquivos) => enviarArquivos(pergunta, arquivos)}
                  aoErro={setErro}
                />
              ))}
            </div>
          ))}

          <Botao type="button" variante="primario" className="h-11" onClick={() => void enviar()} disabled={salvando}>
            <Send className="h-4 w-4" />
            {salvando ? 'Enviando' : 'Enviar respostas'}
          </Botao>
        </section>
      </section>
    </main>
  );
}

function CampoPergunta({
  pergunta,
  valor,
  aoAlterar,
  aoAlternarCheckbox,
  aoEnviarArquivos,
  aoErro
}: {
  pergunta: PerguntaFormularioPublico;
  valor?: ValorResposta;
  aoAlterar: (valor: ValorResposta) => void;
  aoAlternarCheckbox: (valor: string) => void;
  aoEnviarArquivos: (arquivos: File[]) => Promise<string[]>;
  aoErro: (mensagem: string | null) => void;
}) {
  const multipla = pergunta.configuracao.multipla === true;
  const [enviandoArquivos, setEnviandoArquivos] = useState(false);

  return (
    <fieldset className="grid gap-3 rounded-md border border-linha bg-superficie p-4">
      <legend className="text-base font-semibold text-tinta">
        {pergunta.enunciado}
        {pergunta.obrigatoria ? <span className="ml-1 text-perigo">*</span> : null}
      </legend>

      {pergunta.tipo === 'multipla_escolha' ? (
        <div className="grid gap-2">
          {pergunta.opcoes.map((opcao) => (
            <label key={opcao.id} className="flex min-h-10 items-center gap-3 rounded-md border border-linha bg-white px-3 py-2 text-sm">
              <input
                type={multipla ? 'checkbox' : 'radio'}
                name={pergunta.id}
                value={opcao.valor}
                checked={multipla ? Array.isArray(valor) && valor.includes(opcao.valor) : valor === opcao.valor}
                onChange={() => (multipla ? aoAlternarCheckbox(opcao.valor) : aoAlterar(opcao.valor))}
                className="h-4 w-4 accent-primaria"
              />
              <span>{opcao.rotulo}</span>
            </label>
          ))}
        </div>
      ) : null}

      {pergunta.tipo === 'sim_nao' ? (
        <div className="grid grid-cols-2 gap-2">
          <Botao type="button" aria-pressed={valor === true} variante={valor === true ? 'primario' : 'secundario'} onClick={() => aoAlterar(true)}>
            {texto(pergunta.configuracao, 'rotuloSim', 'Sim')}
          </Botao>
          <Botao type="button" aria-pressed={valor === false} variante={valor === false ? 'primario' : 'secundario'} onClick={() => aoAlterar(false)}>
            {texto(pergunta.configuracao, 'rotuloNao', 'Nao')}
          </Botao>
        </div>
      ) : null}

      {pergunta.tipo === 'likert' ? (
        <div className="grid gap-2">
          <div className="flex justify-between text-xs text-texto-suave">
            <span>{texto(pergunta.configuracao, 'rotuloMin', 'Discordo totalmente')}</span>
            <span>{texto(pergunta.configuracao, 'rotuloMax', 'Concordo totalmente')}</span>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {Array.from(
              { length: Math.max(1, numero(pergunta.configuracao, 'escalaMax', 5) - numero(pergunta.configuracao, 'escalaMin', 1) + 1) },
              (_item, indice) => numero(pergunta.configuracao, 'escalaMin', 1) + indice
            ).map((item) => (
              <Botao key={item} type="button" variante={valor === item ? 'primario' : 'secundario'} onClick={() => aoAlterar(item)}>
                {item}
              </Botao>
            ))}
          </div>
        </div>
      ) : null}

      {pergunta.tipo === 'linear' ? (
        <div className="grid gap-2">
          <input
            type="range"
            min={numero(pergunta.configuracao, 'minimo', 0)}
            max={numero(pergunta.configuracao, 'maximo', 10)}
            step={numero(pergunta.configuracao, 'passo', 1)}
            value={typeof valor === 'number' ? valor : numero(pergunta.configuracao, 'minimo', 0)}
            onChange={(event) => aoAlterar(Number(event.target.value))}
            className="w-full accent-primaria"
          />
          <div className="flex justify-between text-xs text-texto-suave">
            <span>{texto(pergunta.configuracao, 'rotuloMin', String(numero(pergunta.configuracao, 'minimo', 0)))}</span>
            <span>{texto(pergunta.configuracao, 'rotuloMax', String(numero(pergunta.configuracao, 'maximo', 10)))}</span>
          </div>
        </div>
      ) : null}

      {pergunta.tipo === 'metrica' ? (
        <div className="grid grid-cols-[1fr_auto] items-center gap-2">
          <Campo
            type="number"
            min={numero(pergunta.configuracao, 'minimo', 0)}
            max={numero(pergunta.configuracao, 'maximo', 100)}
            step={numero(pergunta.configuracao, 'passo', 1)}
            value={typeof valor === 'number' ? valor : ''}
            onChange={(event) => aoAlterar(Number(event.target.value))}
          />
          {texto(pergunta.configuracao, 'unidade') ? <span className="text-sm text-texto-suave">{texto(pergunta.configuracao, 'unidade')}</span> : null}
        </div>
      ) : null}

      {pergunta.tipo === 'texto_longo' ? (
        <textarea
          value={typeof valor === 'string' ? valor : ''}
          maxLength={numero(pergunta.configuracao, 'limiteCaracteres', 1000)}
          placeholder={texto(pergunta.configuracao, 'placeholder')}
          onChange={(event) => aoAlterar(event.target.value)}
          className="min-h-28 w-full resize-none rounded-md border border-linha bg-white px-3 py-2 text-sm"
        />
      ) : null}

      {pergunta.tipo === 'upload_midia' ? (
        <div className="grid gap-2">
          <input
            type="file"
            aria-label={pergunta.enunciado}
            multiple={numero(pergunta.configuracao, 'maxArquivos', 1) > 1}
            accept={Array.isArray(pergunta.configuracao.tiposAceitos) ? pergunta.configuracao.tiposAceitos.join(',') : 'image/*'}
            disabled={enviandoArquivos}
            onChange={async (event) => {
              const arquivos = Array.from(event.target.files ?? []);
              if (!arquivos.length) return;
              setEnviandoArquivos(true);
              aoErro(null);
              try {
                aoAlterar(await aoEnviarArquivos(arquivos));
              } catch (erroAtual) {
                event.target.value = '';
                aoErro(erroAtual instanceof Error ? erroAtual.message : 'Nao foi possivel enviar o arquivo.');
              } finally {
                setEnviandoArquivos(false);
              }
            }}
            className="min-h-11 rounded-md border border-linha bg-white px-3 py-2 text-sm"
          />
          <p className="flex items-center gap-2 text-xs text-texto-suave" aria-live="polite">
            <UploadCloud size={14} />
            {enviandoArquivos ? 'Enviando e verificando arquivo' : Array.isArray(valor) && valor.length ? `${valor.length} arquivo(s) anexado(s)` : 'Nenhum arquivo anexado'}
          </p>
        </div>
      ) : null}
    </fieldset>
  );
}
