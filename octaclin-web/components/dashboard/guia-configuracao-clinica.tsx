'use client';

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle, Eye, EyeOff, RefreshCcw } from 'lucide-react';
import { Botao, classesBotao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { AlertaOperacional, BarraCarregamento } from '@/components/ui/feedback';
import { listarPacientes } from '@/lib/cadastros-api';
import { listarTemplates } from '@/lib/comunicacoes-api';
import { listarModelosPlanoAlimentar } from '@/lib/plano-alimentar-api';
import { listarQuestionarios } from '@/lib/questionarios-api';

type EstadoGuia = { oculto: boolean; puladas: string[] };
type TotaisGuia = { pacientes: number | null; formularios: number | null; modelosPlano: number | null; templates: number | null };

const ESTADO_INICIAL: EstadoGuia = { oculto: false, puladas: [] };
const TOTAIS_INICIAIS: TotaisGuia = { pacientes: null, formularios: null, modelosPlano: null, templates: null };
const inscreverSemEventos = () => () => {};
const snapshotCliente = () => true;
const snapshotServidor = () => false;

function chaveEstado(tenantSlug: string) {
  return `octaclin:onboarding-clinica:v1:${tenantSlug}`;
}

function lerEstadoSalvo(tenantSlug: string): EstadoGuia {
  if (typeof window === 'undefined') return ESTADO_INICIAL;
  try {
    const salvo = window.localStorage.getItem(chaveEstado(tenantSlug));
    if (!salvo) return ESTADO_INICIAL;
    const parseado: unknown = JSON.parse(salvo);
    if (typeof parseado !== 'object' || parseado === null) return ESTADO_INICIAL;
    const candidato = parseado as Partial<EstadoGuia>;
    return {
      oculto: candidato.oculto === true,
      puladas: Array.isArray(candidato.puladas) ? candidato.puladas.filter((id): id is string => typeof id === 'string') : []
    };
  } catch {
    return ESTADO_INICIAL;
  }
}

export function GuiaConfiguracaoClinica({ tenantSlug }: { tenantSlug: string }) {
  const [estado, setEstado] = useState<EstadoGuia>(() => lerEstadoSalvo(tenantSlug));
  const hidratado = useSyncExternalStore(inscreverSemEventos, snapshotCliente, snapshotServidor);
  const [totais, setTotais] = useState<TotaisGuia>(TOTAIS_INICIAIS);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    const resultados = await Promise.allSettled([
      listarPacientes({ pagina: 1, limite: 1 }),
      listarQuestionarios({ pagina: 1, limite: 1 }),
      listarModelosPlanoAlimentar({ pagina: 1, limite: 1, origem: 'pessoal' }),
      listarTemplates()
    ]);

    setTotais({
      pacientes: resultados[0].status === 'fulfilled' ? resultados[0].value.total : null,
      formularios: resultados[1].status === 'fulfilled' ? resultados[1].value.total : null,
      modelosPlano: resultados[2].status === 'fulfilled' ? resultados[2].value.total : null,
      templates: resultados[3].status === 'fulfilled' ? resultados[3].value.length : null
    });
    if (resultados.some((resultado) => resultado.status === 'rejected')) {
      setErro('Algumas etapas não puderam ser verificadas agora. Você ainda pode abrir as funcionalidades ou tentar novamente.');
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(carregar);
  }, [carregar]);

  useEffect(() => {
    try {
      window.localStorage.setItem(chaveEstado(tenantSlug), JSON.stringify(estado));
    } catch {
      // Falha de persistência não deve bloquear o uso da plataforma.
    }
  }, [estado, tenantSlug]);

  const etapas = useMemo(() => [
    {
      id: 'paciente', titulo: 'Cadastrar primeiro paciente', descricao: 'O guia reconhece esta etapa quando já existe ao menos um paciente cadastrado.',
      href: '/pacientes' as const, acao: 'Cadastrar paciente', total: totais.pacientes, concluida: totais.pacientes !== null && totais.pacientes > 0, opcional: false
    },
    {
      id: 'formularios', titulo: 'Configurar formulários iniciais', descricao: 'Use Triagem de primeira consulta e Check-in semanal de adesão como ponto de partida. Cada modelo cria um formulário próprio que pode ser editado no editor.',
      href: '/questionarios' as const, acao: 'Abrir modelos de formulários', total: totais.formularios, concluida: totais.formularios !== null && totais.formularios > 0, opcional: true
    },
    {
      id: 'modelo-plano', titulo: 'Criar ou revisar modelo de plano', descricao: 'Crie um modelo pessoal a partir de um plano no prontuário. Os modelos pessoais podem ser editados pelos recursos já disponíveis.',
      href: '/pacientes' as const, acao: 'Abrir pacientes e prontuários', total: totais.modelosPlano, concluida: totais.modelosPlano !== null && totais.modelosPlano > 0, opcional: true
    },
    {
      id: 'comunicacoes', titulo: 'Preparar comunicações iniciais', descricao: 'Acesse os fluxos atuais para convites, boas-vindas e lembretes. Modelos de integração seguem as opções de edição oferecidas pelo próprio fluxo.',
      href: '/comunicacoes' as const, acao: 'Abrir comunicações', total: totais.templates, concluida: totais.templates !== null && totais.templates > 0, opcional: true
    }
  ], [totais]);

  const concluidas = etapas.filter((etapa) => etapa.concluida).length;
  const puladas = etapas.filter((etapa) => etapa.opcional && !etapa.concluida && estado.puladas.includes(etapa.id));
  const pendentes = etapas.length - concluidas - puladas.length;

  if (!hidratado) return null;
  if (estado.oculto) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-linha bg-superficie px-4 py-3">
        <p className="text-sm text-texto-suave">O guia de configuração está oculto. Você pode retomá-lo quando quiser.</p>
        <Botao type="button" tamanho="sm" onClick={() => setEstado((atual) => ({ ...atual, oculto: false }))}>
          <Eye size={16} aria-hidden="true" /> Mostrar guia de configuração
        </Botao>
      </div>
    );
  }

  return (
    <section aria-label="Guia de configuração inicial da clínica" className="mb-5 grid gap-4">
      <Cartao>
        <CartaoCabecalho className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CartaoTitulo>Configure sua clínica no seu ritmo</CartaoTitulo>
            <p className="mt-1 text-sm text-texto-suave">Etapas opcionais podem ser puladas. Seu progresso fica salvo neste navegador e você pode voltar ao guia depois.</p>
            <p className="mt-2 text-xs font-medium text-texto-suave" aria-live="polite">{concluidas} concluídas · {puladas.length} puladas · {pendentes} pendentes</p>
          </div>
          <div className="flex gap-2">
            <Botao type="button" tamanho="sm" variante="secundario" onClick={() => void carregar()} disabled={carregando}>
              <RefreshCcw size={15} aria-hidden="true" /> Atualizar
            </Botao>
            <Botao type="button" tamanho="sm" variante="fantasma" onClick={() => setEstado((atual) => ({ ...atual, oculto: true }))}>
              <EyeOff size={15} aria-hidden="true" /> Ocultar guia
            </Botao>
          </div>
        </CartaoCabecalho>
        <CartaoConteudo>
          <BarraCarregamento visivel={carregando} rotulo="Verificando configurações existentes" />
          {erro ? <AlertaOperacional mensagem={erro} /> : null}
          <div className="grid gap-3 md:grid-cols-2">
            {etapas.map((etapa) => {
              const pulada = !etapa.concluida && estado.puladas.includes(etapa.id);
              const status = etapa.concluida ? 'Concluída' : pulada ? 'Pulada' : etapa.total === null ? 'Não verificada' : 'Pendente';
              return (
                <article key={etapa.id} aria-label={etapa.titulo} className="grid content-start gap-3 rounded-lg border border-linha bg-superficie p-4">
                  <div className="flex items-start gap-2">
                    {etapa.concluida ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sucesso-forte" aria-hidden="true" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-texto-sutil" aria-hidden="true" />}
                    <h3 className="text-sm font-semibold text-texto-forte">{etapa.titulo}</h3>
                    <span className="ml-auto text-xs text-texto-suave">{status}</span>
                  </div>
                  <p className="text-sm leading-5 text-texto-suave">{etapa.descricao}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={etapa.href} className={classesBotao({ tamanho: 'sm' })}>{etapa.acao}<ArrowRight size={15} aria-hidden="true" /></Link>
                    {etapa.opcional && !etapa.concluida ? (
                      <Botao type="button" tamanho="sm" variante="fantasma" onClick={() => setEstado((atual) => ({
                        ...atual,
                        puladas: pulada ? atual.puladas.filter((id) => id !== etapa.id) : [...new Set([...atual.puladas, etapa.id])]
                      }))}>{pulada ? 'Retomar etapa' : 'Pular etapa'}</Botao>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-3xl text-xs leading-5 text-texto-suave">Convites de pacientes e materiais são acessados pelos fluxos do prontuário. Mensagens de boas-vindas e lembretes seguem os recursos atuais de comunicação; as opções de edição variam por área.</p>
            <Link href="/pacientes" className={classesBotao({ tamanho: 'sm', variante: 'fantasma' })}>Abrir prontuários para convites e materiais<ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        </CartaoConteudo>
      </Cartao>
    </section>
  );
}
