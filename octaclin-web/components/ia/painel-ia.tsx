'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Brain, CheckCircle2, Image, RefreshCcw, ScanSearch, Sparkles } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import {
  AnaliseSentimentoApi,
  ReconhecimentoAlimentarApi,
  analisarSentimento,
  carregarBootstrapIa,
  reconhecerAlimento
} from '@/lib/ia-api';
import { PacienteResumo, RespostaPaginada } from '@/lib/cadastros-api';

interface FormularioSentimento {
  pacienteId: string;
  texto: string;
  origem: string;
}

interface FormularioAlimento {
  pacienteId: string;
  arquivoMidiaId: string;
  imagemUrl: string;
  observacao: string;
}

const sentimentoInicial: FormularioSentimento = {
  pacienteId: '',
  texto: 'Estou com dificuldade para manter a rotina e fiquei frustrado com meu progresso esta semana.',
  origem: 'checkin_manual'
};

const alimentoInicial: FormularioAlimento = {
  pacienteId: '',
  arquivoMidiaId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab',
  imagemUrl: 'https://example.com/prato-demo.jpg',
  observacao: 'Prato principal enviado pelo paciente.'
};

function formatarScore(valor: string) {
  return Number(valor).toFixed(1);
}

function resumirJson(valor: unknown) {
  return JSON.stringify(valor);
}

export function PainelIa() {
  const [pacientes, setPacientes] = useState<RespostaPaginada<PacienteResumo> | null>(null);
  const [sentimento, setSentimento] = useState<FormularioSentimento>(sentimentoInicial);
  const [alimento, setAlimento] = useState<FormularioAlimento>(alimentoInicial);
  const [analises, setAnalises] = useState<AnaliseSentimentoApi[]>([]);
  const [reconhecimentos, setReconhecimentos] = useState<ReconhecimentoAlimentarApi[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [processando, setProcessando] = useState(false);

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
        imagemUrl: alimento.imagemUrl || undefined,
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

  useEffect(() => {
    void carregar();
  }, []);

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-linha bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold">IA operacional</h2>
          <p className="mt-1 text-sm text-texto-suave">
            {analises.length} analises, {reconhecimentos.length} reconhecimentos persistidos
          </p>
        </div>
        <Botao onClick={carregar} disabled={carregando}>
          <RefreshCcw size={16} />
          {carregando ? 'Atualizando' : 'Atualizar'}
        </Botao>
      </div>

      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      <BarraCarregamento visivel={carregando} />
      {sucesso ? (
        <div className="flex items-center gap-2 rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte">
          <CheckCircle2 size={16} />
          {sucesso}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-2">
        <form onSubmit={executarSentimento} className="rounded-lg border border-linha bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Brain size={18} className="text-primaria" />
            <h3 className="text-sm font-semibold">Analise de sentimento</h3>
          </div>
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
        </form>

        <form onSubmit={executarReconhecimento} className="rounded-lg border border-linha bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Image size={18} className="text-primaria" />
            <h3 className="text-sm font-semibold">Reconhecimento alimentar</h3>
          </div>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Rotulo htmlFor="ia-alimento-paciente">Paciente</Rotulo>
              <Selecao
                id="ia-alimento-paciente"
                value={alimento.pacienteId}
                onChange={(evento) => setAlimento((atual) => ({ ...atual, pacienteId: evento.target.value }))}
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
              <Campo
                id="ia-alimento-arquivo"
                value={alimento.arquivoMidiaId}
                onChange={(evento) => setAlimento((atual) => ({ ...atual, arquivoMidiaId: evento.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="ia-alimento-url">Imagem URL</Rotulo>
              <Campo
                id="ia-alimento-url"
                value={alimento.imagemUrl}
                onChange={(evento) => setAlimento((atual) => ({ ...atual, imagemUrl: evento.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="ia-alimento-observacao">Observacao</Rotulo>
              <AreaTexto
                id="ia-alimento-observacao"
                value={alimento.observacao}
                onChange={(evento) => setAlimento((atual) => ({ ...atual, observacao: evento.target.value }))}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario" disabled={processando || !alimento.pacienteId}>
              <ScanSearch size={16} />
              Reconhecer
            </Botao>
          </div>
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <aside className="rounded-lg border border-linha bg-white">
          <div className="border-b border-linha px-4 py-3">
            <h3 className="text-sm font-semibold">Sentimentos recentes</h3>
          </div>
          <div className="max-h-[420px] divide-y divide-linha overflow-auto">
            {analises.length ? (
              analises.map((analise) => (
                <div key={analise.id} className="grid gap-2 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="truncate">{analise.modelo}</strong>
                    <span className="rounded-sm bg-superficie-hover px-2 py-1 text-xs font-semibold text-texto-suave">
                      {analise.alertaDisparado ? 'Alerta' : 'Monitorar'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-texto-suave">
                    <span>Ansiedade: {formatarScore(analise.ansiedadeScore)}</span>
                    <span>Frustracao: {formatarScore(analise.frustracaoScore)}</span>
                    <span>Motivacao: {formatarScore(analise.motivacaoScore)}</span>
                    <span>Confusao: {formatarScore(analise.confusaoScore)}</span>
                  </div>
                  <p className="break-all text-xs text-texto-suave">Explicacao: {resumirJson(analise.explicacao)}</p>
                </div>
              ))
            ) : (
              <EstadoVazio titulo="Nenhuma analise persistida." />
            )}
          </div>
        </aside>

        <aside className="rounded-lg border border-linha bg-white">
          <div className="border-b border-linha px-4 py-3">
            <h3 className="text-sm font-semibold">Reconhecimentos recentes</h3>
          </div>
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
                  <p className="break-all text-xs text-texto-suave">Alimentos: {resumirJson(item.alimentosDetectados)}</p>
                </div>
              ))
            ) : (
              <EstadoVazio titulo="Nenhum reconhecimento persistido." />
            )}
          </div>
        </aside>
      </section>
    </section>
  );
}
