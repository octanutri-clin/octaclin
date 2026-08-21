'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { Brain, Check, CheckCircle2, FileHeart, Image as ImageIcon, MessageSquare, Pencil, RefreshCcw, ScanSearch, Sparkles, X } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { AreaTexto, Rotulo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import {
  AnaliseSentimentoApi,
  DecisaoRevisaoIaApi,
  ReconhecimentoAlimentarApi,
  analisarSentimento,
  carregarBootstrapIa,
  reconhecerAlimento,
  revisarSugestaoIa
} from '@/lib/ia-api';
import { PacienteResumo, RespostaPaginada } from '@/lib/cadastros-api';
import { ArquivoMidiaApi, listarArquivosMidia } from '@/lib/mobile-api';

interface FormularioSentimento {
  pacienteId: string;
  texto: string;
  origem: string;
}

interface FormularioAlimento {
  pacienteId: string;
  arquivoMidiaId: string;
  observacao: string;
}

const sentimentoInicial: FormularioSentimento = {
  pacienteId: '',
  texto: 'Estou com dificuldade para manter a rotina e fiquei frustrado com meu progresso esta semana.',
  origem: 'checkin_manual'
};

const alimentoInicial: FormularioAlimento = {
  pacienteId: '',
  arquivoMidiaId: '',
  observacao: 'Prato principal enviado pelo paciente.'
};

function formatarScore(valor: string) {
  return Number(valor).toFixed(1);
}

function resumirJson(valor: unknown) {
  return JSON.stringify(valor);
}

function rotuloRevisao(status?: string) {
  const rotulos: Record<string, string> = {
    pendente: 'Revisao pendente',
    aceita: 'Aceita pelo profissional',
    editada: 'Editada pelo profissional',
    rejeitada: 'Rejeitada pelo profissional'
  };
  return rotulos[status ?? 'pendente'] ?? 'Revisao pendente';
}

function limitacoesSentimento(explicacao: Record<string, unknown>) {
  return Array.isArray(explicacao.limitacoes)
    ? explicacao.limitacoes.filter((item): item is string => typeof item === 'string')
    : [];
}

function rotuloSinal(analise: AnaliseSentimentoApi) {
  if ((analise.revisaoHumana?.status ?? 'pendente') === 'pendente') return 'Aguardando revisao';
  return analise.alertaDisparado ? 'Alerta' : 'Monitorar';
}

export function PainelIa() {
  const [pacientes, setPacientes] = useState<RespostaPaginada<PacienteResumo> | null>(null);
  const [sentimento, setSentimento] = useState<FormularioSentimento>(sentimentoInicial);
  const [alimento, setAlimento] = useState<FormularioAlimento>(alimentoInicial);
  const [analises, setAnalises] = useState<AnaliseSentimentoApi[]>([]);
  const [reconhecimentos, setReconhecimentos] = useState<ReconhecimentoAlimentarApi[]>([]);
  const [imagens, setImagens] = useState<ArquivoMidiaApi[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [carregandoImagens, setCarregandoImagens] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [revisandoId, setRevisandoId] = useState<string | null>(null);
  const [observacoes, setObservacoes] = useState<Record<string, string>>({});

  async function carregar() {
    setCarregando(true);
    setErro(null);
    setSucesso(null);
    try {
      const bootstrap = await carregarBootstrapIa();
      setPacientes(bootstrap.pacientes);
      setAnalises(bootstrap.analises);
      setReconhecimentos(bootstrap.reconhecimentos);
      setSentimento((atual) => ({ ...atual, pacienteId: atual.pacienteId || bootstrap.pacientes.itens[0]?.id || '' }));
      setAlimento((atual) => ({ ...atual, pacienteId: atual.pacienteId || bootstrap.pacientes.itens[0]?.id || '' }));
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar IA.');
    } finally {
      setCarregando(false);
    }
  }

  async function executarSentimento(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setProcessando(true);
    setErro(null);
    setSucesso(null);
    try {
      const resultado = await analisarSentimento({
        pacienteId: sentimento.pacienteId,
        texto: sentimento.texto,
        contexto: { origem: sentimento.origem }
      });
      setAnalises((atuais) => [resultado, ...atuais].slice(0, 6));
      setSucesso(`Sentimento analisado com frustracao ${formatarScore(resultado.frustracaoScore)}.`);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao analisar sentimento.');
    } finally {
      setProcessando(false);
    }
  }

  async function executarReconhecimento(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setProcessando(true);
    setErro(null);
    setSucesso(null);
    try {
      const resultado = await reconhecerAlimento({
        pacienteId: alimento.pacienteId,
        arquivoMidiaId: alimento.arquivoMidiaId,
        contexto: { observacao: alimento.observacao }
      });
      setReconhecimentos((atuais) => [resultado, ...atuais].slice(0, 6));
      setSucesso(`Reconhecimento alimentar criado por ${resultado.provedor}.`);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao reconhecer alimento.');
    } finally {
      setProcessando(false);
    }
  }

  async function revisarSentimento(id: string, decisao: DecisaoRevisaoIaApi) {
    setRevisandoId(id);
    setErro(null);
    try {
      const atualizada = await revisarSugestaoIa<AnaliseSentimentoApi>(
        'sentimento',
        id,
        decisao,
        decisao === 'editada' ? { interpretacaoProfissional: observacoes[id] } : undefined
      );
      setAnalises((atuais) => atuais.map((item) => (item.id === id ? atualizada : item)));
      setSucesso('Revisão humana registrada.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao registrar revisao.');
    } finally {
      setRevisandoId(null);
    }
  }

  async function revisarAlimento(id: string, decisao: DecisaoRevisaoIaApi) {
    setRevisandoId(id);
    setErro(null);
    try {
      const atualizado = await revisarSugestaoIa<ReconhecimentoAlimentarApi>(
        'reconhecimento-alimentar',
        id,
        decisao,
        decisao === 'editada' ? { alimentosCorrigidos: observacoes[id] } : undefined
      );
      setReconhecimentos((atuais) => atuais.map((item) => (item.id === id ? atualizado : item)));
      setSucesso('Revisão humana registrada.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao registrar revisao.');
    } finally {
      setRevisandoId(null);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  useEffect(() => {
    let ativo = true;
    if (!alimento.pacienteId) {
      setImagens([]);
      return () => { ativo = false; };
    }
    setCarregandoImagens(true);
    void listarArquivosMidia(alimento.pacienteId)
      .then((arquivos) => {
        if (!ativo) return;
        const confirmadas = arquivos.filter((arquivo) => arquivo.tipo === 'imagem' && arquivo.status === 'confirmado');
        setImagens(confirmadas);
        setAlimento((atual) => ({
          ...atual,
          arquivoMidiaId: confirmadas.some((arquivo) => arquivo.id === atual.arquivoMidiaId)
            ? atual.arquivoMidiaId
            : confirmadas[0]?.id ?? ''
        }));
      })
      .catch((erroAtual) => {
        if (ativo) {
          setImagens([]);
          setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar imagens clinicas.');
        }
      })
      .finally(() => {
        if (ativo) setCarregandoImagens(false);
      });
    return () => { ativo = false; };
  }, [alimento.pacienteId]);

  return (
    <section className="grid gap-4">
      <Cartao>
        <CartaoConteudo className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold">IA operacional</h2>
            <p className="mt-1 text-sm text-texto-suave">
              {analises.length} analises, {reconhecimentos.length} reconhecimentos persistidos
            </p>
            <p className="mt-1 text-xs text-texto-sutil">Resultados de IA sao sugestoes operacionais e exigem revisão do profissional antes de qualquer conduta.</p>
          </div>
          <Botao onClick={carregar} disabled={carregando}>
            <RefreshCcw size={16} />
            {carregando ? 'Atualizando' : 'Atualizar'}
          </Botao>
        </CartaoConteudo>
      </Cartao>

      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      <BarraCarregamento visivel={carregando} />
      {sucesso ? (
        <div className="flex items-center gap-2 rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte">
          <CheckCircle2 size={16} />
          {sucesso}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <Cartao>
        <form onSubmit={executarSentimento}>
          <CartaoCabecalho>
            <CartaoTitulo icone={<Brain size={18} className="text-primaria" />}>Analise de sentimento</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Rotulo htmlFor="ia-sentimento-paciente">Paciente</Rotulo>
              <Selecao
                id="ia-sentimento-paciente"
                value={sentimento.pacienteId}
                onChange={(evento) => setSentimento((atual) => ({ ...atual, pacienteId: evento.target.value }))}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {pacientes?.itens.map((paciente) => (
                  <option key={paciente.id} value={paciente.id}>
                    {paciente.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="ia-sentimento-origem">Origem</Rotulo>
              <Selecao
                id="ia-sentimento-origem"
                value={sentimento.origem}
                onChange={(evento) => setSentimento((atual) => ({ ...atual, origem: evento.target.value }))}
              >
                <option value="checkin_manual">Check-in manual</option>
                <option value="transcricao_audio">Transcricao de audio</option>
                <option value="mensagem_paciente">Mensagem do paciente</option>
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="ia-sentimento-texto">Texto</Rotulo>
              <AreaTexto
                id="ia-sentimento-texto"
                value={sentimento.texto}
                onChange={(evento) => setSentimento((atual) => ({ ...atual, texto: evento.target.value }))}
                required
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario" disabled={processando || !sentimento.pacienteId}>
              <Sparkles size={16} />
              Analisar
            </Botao>
          </div>
          </CartaoConteudo>
        </form>
        </Cartao>

        <Cartao>
        <form onSubmit={executarReconhecimento}>
          <CartaoCabecalho>
            <CartaoTitulo icone={<ImageIcon size={18} className="text-primaria" />}>Reconhecimento alimentar</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Rotulo htmlFor="ia-alimento-paciente">Paciente</Rotulo>
              <Selecao
                id="ia-alimento-paciente"
                value={alimento.pacienteId}
                onChange={(evento) => setAlimento((atual) => ({
                  ...atual,
                  pacienteId: evento.target.value,
                  arquivoMidiaId: ''
                }))}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {pacientes?.itens.map((paciente) => (
                  <option key={paciente.id} value={paciente.id}>
                    {paciente.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="ia-alimento-arquivo">Arquivo midia</Rotulo>
              <Selecao
                id="ia-alimento-arquivo"
                value={alimento.arquivoMidiaId}
                onChange={(evento) => setAlimento((atual) => ({ ...atual, arquivoMidiaId: evento.target.value }))}
                required
                disabled={carregandoImagens || imagens.length === 0}
              >
                <option value="" disabled>
                  {carregandoImagens ? 'Carregando imagens' : 'Selecione uma imagem confirmada'}
                </option>
                {imagens.map((imagem) => (
                  <option key={imagem.id} value={imagem.id}>
                    {imagem.nomeArquivo || `Imagem de ${new Date(imagem.criadoEm).toLocaleDateString('pt-BR')}`}
                  </option>
                ))}
              </Selecao>
              {!carregandoImagens && alimento.pacienteId && imagens.length === 0 ? (
                <p className="text-xs text-texto-suave">
                  Nenhuma imagem confirmada. Envie uma foto no prontuário do paciente antes de solicitar a analise.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="ia-alimento-observacao">Observação</Rotulo>
              <AreaTexto
                id="ia-alimento-observacao"
                value={alimento.observacao}
                onChange={(evento) => setAlimento((atual) => ({ ...atual, observacao: evento.target.value }))}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario" disabled={processando || !alimento.pacienteId || !alimento.arquivoMidiaId}>
              <ScanSearch size={16} />
              Reconhecer
            </Botao>
          </div>
          </CartaoConteudo>
        </form>
        </Cartao>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Sentimentos recentes</CartaoTitulo>
          </CartaoCabecalho>
          <div className="max-h-[420px] divide-y divide-linha overflow-auto">
            {analises.length ? (
              analises.map((analise) => (
                <div key={analise.id} className="grid gap-2 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="truncate">{analise.modelo}</strong>
                    <span className="rounded-sm bg-superficie-hover px-2 py-1 text-xs font-semibold text-texto-suave">
                      {rotuloSinal(analise)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-texto-suave">
                    <span>Ansiedade: {formatarScore(analise.ansiedadeScore)}</span>
                    <span>Frustracao: {formatarScore(analise.frustracaoScore)}</span>
                    <span>Motivacao: {formatarScore(analise.motivacaoScore)}</span>
                    <span>Confusao: {formatarScore(analise.confusaoScore)}</span>
                  </div>
                  <p className="break-all text-xs text-texto-suave">Sugestao original: {resumirJson(analise.explicacao)}</p>
                  <p className="text-xs text-texto-suave">Fonte: {analise.modelo}.</p>
                  <p className="text-xs text-texto-suave">Limitacoes: {limitacoesSentimento(analise.explicacao).join(' ') || 'O resultado exige avaliacao clinica.'}</p>
                  <strong className="text-xs">{rotuloRevisao(analise.revisaoHumana?.status)}</strong>
                  {analise.revisaoHumana?.status === 'editada' && analise.revisaoHumana.conteudoEditado ? (
                    <p className="break-all rounded-md border border-linha bg-fundo px-3 py-2 text-xs font-medium">
                      Resultado revisado: {resumirJson(analise.revisaoHumana.conteudoEditado)}
                    </p>
                  ) : null}
                  {(analise.revisaoHumana?.status ?? 'pendente') === 'pendente' ? (
                    <div className="grid gap-2">
                      <AreaTexto
                        aria-label={`Observacao da revisao ${analise.id}`}
                        placeholder="Informe a interpretacao clínica corrigida"
                        value={observacoes[analise.id] ?? ''}
                        onChange={(evento) => setObservacoes((atuais) => ({ ...atuais, [analise.id]: evento.target.value }))}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Botao type="button" onClick={() => void revisarSentimento(analise.id, 'aceita')} disabled={revisandoId === analise.id}>
                          <Check size={16} /> Aceitar
                        </Botao>
                        <Botao type="button" onClick={() => void revisarSentimento(analise.id, 'editada')} disabled={revisandoId === analise.id || !observacoes[analise.id]?.trim()}>
                          <Pencil size={16} /> Editar e aceitar
                        </Botao>
                        <Botao type="button" variante="perigo" onClick={() => void revisarSentimento(analise.id, 'rejeitada')} disabled={revisandoId === analise.id}>
                          <X size={16} /> Rejeitar
                        </Botao>
                      </div>
                    </div>
                  ) : analise.revisaoHumana.status !== 'rejeitada' ? (
                    <div className="flex flex-wrap gap-2">
                      <Link className="inline-flex min-h-11 items-center gap-2 rounded-md border border-linha px-3 text-sm font-medium" href={`/pacientes/${analise.pacienteId}`}>
                        <FileHeart size={16} /> Abrir prontuário
                      </Link>
                      <Link className="inline-flex min-h-11 items-center gap-2 rounded-md border border-linha px-3 text-sm font-medium" href="/comunicacoes">
                        <MessageSquare size={16} /> Preparar comunicação
                      </Link>
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <EstadoVazio titulo="Nenhuma analise persistida." />
            )}
          </div>
        </Cartao>

        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Reconhecimentos recentes</CartaoTitulo>
          </CartaoCabecalho>
          <div className="max-h-[420px] divide-y divide-linha overflow-auto">
            {reconhecimentos.length ? (
              reconhecimentos.map((item) => (
                <div key={item.id} className="grid gap-2 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="truncate">{item.provedor}</strong>
                    <span className="rounded-sm bg-superficie-hover px-2 py-1 text-xs font-semibold text-texto-suave">
                      {item.confiancaMedia ? `${formatarScore(item.confiancaMedia)}%` : 'Sem score'}
                    </span>
                  </div>
                  <p className="text-xs text-texto-suave">
                    {item.caloriasEstimadas ? `${formatarScore(item.caloriasEstimadas)} kcal` : 'Calorias nao estimadas'}
                    {item.pesoEstimadoGramas ? ` | ${formatarScore(item.pesoEstimadoGramas)} g` : ''}
                  </p>
                  <p className="break-all text-xs text-texto-suave">Sugestao original: {resumirJson(item.alimentosDetectados)}</p>
                  <p className="text-xs text-texto-suave">Fonte: {item.provedor}.</p>
                  <p className="text-xs text-texto-suave">Limitacoes: {item.limitacoes?.join(' ') || 'A estimativa exige confirmacao profissional.'}</p>
                  <strong className="text-xs">{rotuloRevisao(item.revisaoHumana?.status)}</strong>
                  {item.revisaoHumana?.status === 'editada' && item.revisaoHumana.conteudoEditado ? (
                    <p className="break-all rounded-md border border-linha bg-fundo px-3 py-2 text-xs font-medium">
                      Resultado revisado: {resumirJson(item.revisaoHumana.conteudoEditado)}
                    </p>
                  ) : null}
                  {(item.revisaoHumana?.status ?? 'pendente') === 'pendente' ? (
                    <div className="grid gap-2">
                      <AreaTexto
                        aria-label={`Observacao da revisao ${item.id}`}
                        placeholder="Informe os alimentos ou porcoes corrigidos"
                        value={observacoes[item.id] ?? ''}
                        onChange={(evento) => setObservacoes((atuais) => ({ ...atuais, [item.id]: evento.target.value }))}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Botao type="button" onClick={() => void revisarAlimento(item.id, 'aceita')} disabled={revisandoId === item.id}>
                          <Check size={16} /> Aceitar
                        </Botao>
                        <Botao type="button" onClick={() => void revisarAlimento(item.id, 'editada')} disabled={revisandoId === item.id || !observacoes[item.id]?.trim()}>
                          <Pencil size={16} /> Editar e aceitar
                        </Botao>
                        <Botao type="button" variante="perigo" onClick={() => void revisarAlimento(item.id, 'rejeitada')} disabled={revisandoId === item.id}>
                          <X size={16} /> Rejeitar
                        </Botao>
                      </div>
                    </div>
                  ) : item.revisaoHumana.status !== 'rejeitada' ? (
                    <Link className="inline-flex min-h-11 items-center gap-2 rounded-md border border-linha px-3 text-sm font-medium" href={`/pacientes/${item.pacienteId}`}>
                      <FileHeart size={16} /> Abrir prontuário
                    </Link>
                  ) : null}
                </div>
              ))
            ) : (
              <EstadoVazio titulo="Nenhum reconhecimento persistido." />
            )}
          </div>
        </Cartao>
      </section>
    </section>
  );
}
