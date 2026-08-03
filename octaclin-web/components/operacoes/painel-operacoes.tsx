'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequisicaoCancelavel } from '@/lib/hooks';
import { Activity, AlertTriangle, CheckCircle2, CreditCard, Download, History, RefreshCcw, Scale, Search, Smartphone, Undo2 } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Abas } from '@/components/ui/abas';
import { Cartao, CartaoCabecalho, CartaoConteudo } from '@/components/ui/cartao';
import { AlertaOperacional, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import { SessaoPublica, obterSessao, sair } from '@/lib/auth-api';
import {
  AcaoRetencaoDadosOperacional,
  AuditoriaOperacional,
  DadosOperacionais,
  DetalheSolicitacaoLgpdOperacional,
  ErroApiOperacoes,
  FalhaComunicacaoOperacional,
  FiltrosAuditoriaOperacional,
  FiltrosFalhasComunicacao,
  FiltrosOutboxOperacional,
  FiltrosSolicitacoesLgpd,
  OutboxFalha,
  RespostaSolicitacaoLgpdOperacional,
  StatusSolicitacaoLgpd,
  SolicitacaoAssinaturaOperacional,
  SolicitacaoLgpdOperacional,
  aplicarPlanoAssinatura,
  atualizarSolicitacaoLgpd,
  carregarAuditoriaOperacionalPaginada,
  carregarFalhasComunicacao,
  carregarFalhasOutboxPaginadas,
  carregarDadosOperacionais,
  carregarSolicitacoesAssinatura,
  carregarSolicitacoesLgpd,
  carregarRetencaoDadosOperacional,
  obterDetalheSolicitacaoLgpd,
  prepararRespostaSolicitacaoLgpd,
  programarRetencaoDadosOperacional,
  reprocessarFalhaComunicacao,
  reprocessarOutbox,
  urlExportacaoAuditoria,
  urlExportacaoFalhasOutbox,
  urlExportacaoSolicitacaoLgpd
} from '@/lib/operacoes-api';

function formatarData(valor?: string) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(data);
}

function resumirPayload(payload: OutboxFalha['payload']) {
  const mensagemId = payload?.mensagemId;
  return typeof mensagemId === 'string' ? `mensagem ${mensagemId}` : JSON.stringify(payload);
}

function rotuloOrigemFalha(origem: FalhaComunicacaoOperacional['origem']) {
  const mapa: Record<FalhaComunicacaoOperacional['origem'], string> = {
    mensagem: 'Mensagem',
    outbox: 'Outbox',
    google_calendar: 'Google Calendar'
  };
  return mapa[origem];
}

function rotuloCanalFalha(canal: FalhaComunicacaoOperacional['canal']) {
  const mapa: Record<FalhaComunicacaoOperacional['canal'], string> = {
    email: 'E-mail',
    whatsapp: 'WhatsApp',
    push: 'Push',
    google_calendar: 'Google Calendar',
    outbox: 'Outbox',
    outro: 'Outro'
  };
  return mapa[canal];
}

function resumirMetadados(metadados: AuditoriaOperacional['metadados']) {
  const pares = Object.entries(metadados ?? {});
  if (!pares.length) return '-';
  return pares.map(([chave, valor]) => `${chave}: ${String(valor)}`).join(' | ');
}

function rotuloTipoLgpd(tipo: SolicitacaoLgpdOperacional['tipo']) {
  return tipo === 'retificacao' ? 'Retificacao' : 'Exclusao';
}

function rotuloStatusLgpd(status: StatusSolicitacaoLgpd) {
  const mapa: Record<StatusSolicitacaoLgpd, string> = {
    recebida: 'Recebida',
    em_tratamento: 'Em tratamento',
    concluida: 'Concluida',
    indeferida: 'Indeferida'
  };
  return mapa[status];
}

function classeStatusLgpd(status: StatusSolicitacaoLgpd) {
  const mapa: Record<StatusSolicitacaoLgpd, string> = {
    recebida: 'bg-superficie-hover text-primaria',
    em_tratamento: 'bg-alerta-suave text-alerta-forte',
    concluida: 'bg-sucesso-suave text-sucesso',
    indeferida: 'bg-perigo-suave text-perigo'
  };
  return mapa[status];
}

function rotuloAcaoRetencao(acao: AcaoRetencaoDadosOperacional) {
  const mapa: Record<AcaoRetencaoDadosOperacional, string> = {
    preservar: 'Preservar',
    anonimizar: 'Anonimizar',
    excluir: 'Excluir',
    arquivar_exportar: 'Arquivar/exportar'
  };
  return mapa[acao];
}

function pluralizarItensRetencao(total: number) {
  return `${total} ${total === 1 ? 'item vencido' : 'itens vencidos'}`;
}

function rotuloPlano(plano: SolicitacaoAssinaturaOperacional['planoAtualId']) {
  const mapa: Record<SolicitacaoAssinaturaOperacional['planoAtualId'], string> = {
    gratuito: 'Gratuito',
    profissional: 'Profissional',
    clinica: 'Clinica',
    enterprise: 'Enterprise'
  };
  return mapa[plano];
}

function rotuloStatusAssinatura(status: SolicitacaoAssinaturaOperacional['status']) {
  const mapa: Record<SolicitacaoAssinaturaOperacional['status'], string> = {
    pendente: 'Pendente',
    concluida: 'Concluida',
    cancelada: 'Cancelada'
  };
  return mapa[status];
}

function classeStatusAssinatura(status: SolicitacaoAssinaturaOperacional['status']) {
  const mapa: Record<SolicitacaoAssinaturaOperacional['status'], string> = {
    pendente: 'bg-alerta-suave text-alerta-forte',
    concluida: 'bg-sucesso-suave text-sucesso',
    cancelada: 'bg-perigo-suave text-perigo'
  };
  return mapa[status];
}

function rotuloStatusAlertas(status: DadosOperacionais['alertasOperacionais']['status']) {
  const mapa: Record<DadosOperacionais['alertasOperacionais']['status'], string> = {
    ok: 'OK',
    informativo: 'Informativo',
    atencao: 'Atencao',
    critico: 'Critico'
  };
  return mapa[status];
}

function classeSeveridadeAlerta(severidade: DadosOperacionais['alertasOperacionais']['itens'][number]['severidade']) {
  const mapa: Record<DadosOperacionais['alertasOperacionais']['itens'][number]['severidade'], string> = {
    critico: 'border-perigo bg-perigo-suave text-perigo',
    atencao: 'border-alerta-borda bg-alerta-suave text-alerta-forte',
    informativo: 'border-primaria-suave bg-superficie text-primaria'
  };
  return mapa[severidade];
}

function chaveSolicitacaoAssinatura(solicitacao: SolicitacaoAssinaturaOperacional) {
  return `${solicitacao.tenantId}:${solicitacao.solicitadoEm}:${solicitacao.planoDesejado ?? solicitacao.planoAtualId}`;
}

type AreaOperacoes = 'saude' | 'incidentes' | 'comunicacoes' | 'lgpd' | 'auditoria' | 'filas';

const areasOperacoes = [
  { id: 'saude', rotulo: 'Saude' },
  { id: 'incidentes', rotulo: 'Incidentes' },
  { id: 'comunicacoes', rotulo: 'Comunicacoes' },
  { id: 'lgpd', rotulo: 'LGPD' },
  { id: 'auditoria', rotulo: 'Auditoria' },
  { id: 'filas', rotulo: 'Filas' }
];

export function PainelOperacoes() {
  const router = useRouter();
  const iniciarRequisicaoDados = useRequisicaoCancelavel();
  const iniciarRequisicaoAuditoria = useRequisicaoCancelavel();
  const iniciarRequisicaoOutbox = useRequisicaoCancelavel();
  const iniciarRequisicaoFalhasComunicacao = useRequisicaoCancelavel();
  const iniciarRequisicaoAssinatura = useRequisicaoCancelavel();
  const iniciarRequisicaoLgpd = useRequisicaoCancelavel();
  const iniciarRequisicaoDetalheLgpd = useRequisicaoCancelavel();
  const [sessao, setSessao] = useState<SessaoPublica | null>(null);
  const [areaAtiva, setAreaAtiva] = useState<AreaOperacoes>('saude');
  const [dados, setDados] = useState<DadosOperacionais | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [carregandoAuditoria, setCarregandoAuditoria] = useState(false);
  const [carregandoAssinatura, setCarregandoAssinatura] = useState(false);
  const [carregandoLgpd, setCarregandoLgpd] = useState(false);
  const [carregandoDetalheLgpd, setCarregandoDetalheLgpd] = useState(false);
  const [reprocessandoId, setReprocessandoId] = useState<string | null>(null);
  const [reprocessandoComunicacaoId, setReprocessandoComunicacaoId] = useState<string | null>(null);
  const [aplicandoAssinaturaId, setAplicandoAssinaturaId] = useState<string | null>(null);
  const [atualizandoLgpdProtocolo, setAtualizandoLgpdProtocolo] = useState<string | null>(null);
  const [preparandoRespostaProtocolo, setPreparandoRespostaProtocolo] = useState<string | null>(null);
  const [programandoRetencao, setProgramandoRetencao] = useState(false);
  const [detalheLgpd, setDetalheLgpd] = useState<DetalheSolicitacaoLgpdOperacional | null>(null);
  const [respostaLgpd, setRespostaLgpd] = useState<RespostaSolicitacaoLgpdOperacional | null>(null);
  const [filtrosAuditoria, setFiltrosAuditoria] = useState<FiltrosAuditoriaOperacional>({
    acao: '',
    recursoTipo: '',
    recursoId: '',
    usuarioId: '',
    inicio: '',
    fim: '',
    pagina: 1,
    limite: 25
  });
  const [filtrosLgpd, setFiltrosLgpd] = useState<FiltrosSolicitacoesLgpd>({
    status: '',
    tipo: '',
    pagina: 1,
    limite: 25
  });
  const [filtrosOutbox, setFiltrosOutbox] = useState<FiltrosOutboxOperacional>({
    tipo: '',
    inicio: '',
    fim: '',
    pagina: 1,
    limite: 25
  });
  const [filtrosFalhasComunicacao, setFiltrosFalhasComunicacao] = useState<FiltrosFalhasComunicacao>({
    origem: '',
    canal: '',
    tipo: '',
    inicio: '',
    fim: '',
    pagina: 1,
    limite: 25
  });

  function redirecionarParaLogin() {
    setSessao(null);
    setDados(null);
    router.replace('/login?redirect=/operacoes');
  }

  async function executarAutenticado<T>(operacao: () => Promise<T>): Promise<T | null> {
    try {
      return await operacao();
    } catch (erroAtual) {
      if (erroAtual instanceof ErroApiOperacoes && erroAtual.status === 401) {
        redirecionarParaLogin();
        return null;
      }

      throw erroAtual;
    }
  }

  async function carregar() {
    if (!sessao) {
      setErro('Sessao ausente. Faca login novamente.');
      setDados(null);
      return;
    }

    const { signal, ehAtual } = iniciarRequisicaoDados();
    setCarregando(true);
    setErro(null);
    setSucesso(null);
    try {
      const resposta = await executarAutenticado(() => carregarDadosOperacionais({ signal }));
      if (!ehAtual()) return;
      if (resposta) setDados(resposta);
      setDetalheLgpd(null);
      setRespostaLgpd(null);
    } catch (erroAtual) {
      if (!ehAtual()) return;
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar operacoes.');
    } finally {
      if (ehAtual()) setCarregando(false);
    }
  }

  async function reprocessar(eventoId: string) {
    if (!sessao) return;
    setReprocessandoId(eventoId);
    setErro(null);
    setSucesso(null);
    try {
      await executarAutenticado(() => reprocessarOutbox(eventoId));
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao reprocessar outbox.');
    } finally {
      setReprocessandoId(null);
    }
  }

  async function reprocessarComunicacao(falhaId: string) {
    if (!sessao) return;
    setReprocessandoComunicacaoId(falhaId);
    setErro(null);
    setSucesso(null);
    try {
      await executarAutenticado(() => reprocessarFalhaComunicacao(falhaId));
      const falhasComunicacao = await executarAutenticado(() =>
        carregarFalhasComunicacao({ ...filtrosFalhasComunicacao, pagina: dados?.falhasComunicacao.pagina ?? 1 })
      );
      if (falhasComunicacao) {
        setDados((dadosAtuais) => (dadosAtuais ? { ...dadosAtuais, falhasComunicacao } : dadosAtuais));
        setSucesso('Falha de comunicacao reenfileirada para reprocessamento.');
      }
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao reprocessar comunicacao.');
    } finally {
      setReprocessandoComunicacaoId(null);
    }
  }

  async function filtrarAuditoria(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!sessao) return;

    const { signal, ehAtual } = iniciarRequisicaoAuditoria();
    setCarregandoAuditoria(true);
    setErro(null);
    setSucesso(null);
    try {
      const auditoria = await executarAutenticado(() =>
        carregarAuditoriaOperacionalPaginada({ ...filtrosAuditoria, pagina: 1 }, { signal })
      );
      if (!ehAtual()) return;
      if (auditoria) {
        setFiltrosAuditoria((atual) => ({ ...atual, pagina: auditoria.pagina }));
        setDados((dadosAtuais) =>
          dadosAtuais ? { ...dadosAtuais, auditoria: auditoria.itens, auditoriaPaginada: auditoria } : dadosAtuais
        );
      }
    } catch (erroAtual) {
      if (!ehAtual()) return;
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar auditoria.');
    } finally {
      if (ehAtual()) setCarregandoAuditoria(false);
    }
  }

  async function filtrarOutbox(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!sessao) return;

    const { signal, ehAtual } = iniciarRequisicaoOutbox();
    setCarregando(true);
    setErro(null);
    setSucesso(null);
    try {
      const falhasPaginadas = await executarAutenticado(() =>
        carregarFalhasOutboxPaginadas({ ...filtrosOutbox, pagina: 1 }, { signal })
      );
      if (!ehAtual()) return;
      if (falhasPaginadas) {
        setFiltrosOutbox((atual) => ({ ...atual, pagina: falhasPaginadas.pagina }));
        setDados((dadosAtuais) =>
          dadosAtuais ? { ...dadosAtuais, falhas: falhasPaginadas.itens, falhasPaginadas } : dadosAtuais
        );
      }
    } catch (erroAtual) {
      if (!ehAtual()) return;
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar outbox.');
    } finally {
      if (ehAtual()) setCarregando(false);
    }
  }

  async function trocarPaginaAuditoria(proximaPagina: number) {
    if (!sessao || proximaPagina < 1) return;
    const { signal, ehAtual } = iniciarRequisicaoAuditoria();
    setCarregandoAuditoria(true);
    setErro(null);
    setSucesso(null);
    try {
      const auditoria = await executarAutenticado(() =>
        carregarAuditoriaOperacionalPaginada({ ...filtrosAuditoria, pagina: proximaPagina }, { signal })
      );
      if (!ehAtual()) return;
      if (auditoria) {
        setFiltrosAuditoria((atual) => ({ ...atual, pagina: auditoria.pagina }));
        setDados((dadosAtuais) =>
          dadosAtuais ? { ...dadosAtuais, auditoria: auditoria.itens, auditoriaPaginada: auditoria } : dadosAtuais
        );
      }
    } catch (erroAtual) {
      if (!ehAtual()) return;
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao paginar auditoria.');
    } finally {
      if (ehAtual()) setCarregandoAuditoria(false);
    }
  }

  async function trocarPaginaOutbox(proximaPagina: number) {
    if (!sessao || proximaPagina < 1) return;
    const { signal, ehAtual } = iniciarRequisicaoOutbox();
    setCarregando(true);
    setErro(null);
    setSucesso(null);
    try {
      const falhasPaginadas = await executarAutenticado(() =>
        carregarFalhasOutboxPaginadas({ ...filtrosOutbox, pagina: proximaPagina }, { signal })
      );
      if (!ehAtual()) return;
      if (falhasPaginadas) {
        setFiltrosOutbox((atual) => ({ ...atual, pagina: falhasPaginadas.pagina }));
        setDados((dadosAtuais) =>
          dadosAtuais ? { ...dadosAtuais, falhas: falhasPaginadas.itens, falhasPaginadas } : dadosAtuais
        );
      }
    } catch (erroAtual) {
      if (!ehAtual()) return;
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao paginar outbox.');
    } finally {
      if (ehAtual()) setCarregando(false);
    }
  }

  async function trocarPaginaFalhasComunicacao(proximaPagina: number) {
    if (!sessao || proximaPagina < 1) return;
    const { signal, ehAtual } = iniciarRequisicaoFalhasComunicacao();
    setCarregando(true);
    setErro(null);
    setSucesso(null);
    try {
      const falhasComunicacao = await executarAutenticado(() =>
        carregarFalhasComunicacao({ ...filtrosFalhasComunicacao, pagina: proximaPagina }, { signal })
      );
      if (!ehAtual()) return;
      if (falhasComunicacao) {
        setFiltrosFalhasComunicacao((atual) => ({ ...atual, pagina: falhasComunicacao.pagina }));
        setDados((dadosAtuais) => (dadosAtuais ? { ...dadosAtuais, falhasComunicacao } : dadosAtuais));
      }
    } catch (erroAtual) {
      if (!ehAtual()) return;
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao paginar central de comunicacao.');
    } finally {
      if (ehAtual()) setCarregando(false);
    }
  }

  async function filtrarFalhasComunicacao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!sessao) return;

    const { signal, ehAtual } = iniciarRequisicaoFalhasComunicacao();
    setCarregando(true);
    setErro(null);
    setSucesso(null);
    try {
      const falhasComunicacao = await executarAutenticado(() =>
        carregarFalhasComunicacao({ ...filtrosFalhasComunicacao, pagina: 1 }, { signal })
      );
      if (!ehAtual()) return;
      if (falhasComunicacao) {
        setFiltrosFalhasComunicacao((atual) => ({ ...atual, pagina: falhasComunicacao.pagina }));
        setDados((dadosAtuais) => (dadosAtuais ? { ...dadosAtuais, falhasComunicacao } : dadosAtuais));
      }
    } catch (erroAtual) {
      if (!ehAtual()) return;
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar central de comunicacao.');
    } finally {
      if (ehAtual()) setCarregando(false);
    }
  }

  async function recarregarSolicitacoesAssinatura(opcoes: { preservarMensagem?: boolean } = {}) {
    if (!sessao) return;

    const { signal, ehAtual } = iniciarRequisicaoAssinatura();
    setCarregandoAssinatura(true);
    setErro(null);
    if (!opcoes.preservarMensagem) setSucesso(null);
    try {
      const solicitacoesAssinatura = await executarAutenticado(() =>
        carregarSolicitacoesAssinatura(
          {
            pagina: dados?.solicitacoesAssinatura.pagina ?? 1,
            limite: dados?.solicitacoesAssinatura.limite ?? 25
          },
          { signal }
        )
      );
      if (!ehAtual()) return;
      if (solicitacoesAssinatura) {
        setDados((dadosAtuais) => (dadosAtuais ? { ...dadosAtuais, solicitacoesAssinatura } : dadosAtuais));
      }
    } catch (erroAtual) {
      if (!ehAtual()) return;
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar solicitacoes de assinatura.');
    } finally {
      if (ehAtual()) setCarregandoAssinatura(false);
    }
  }

  async function aplicarPlanoSolicitacao(solicitacao: SolicitacaoAssinaturaOperacional) {
    if (!sessao || solicitacao.status !== 'pendente') return;

    const chave = chaveSolicitacaoAssinatura(solicitacao);
    const planoId = solicitacao.planoDesejado ?? solicitacao.planoAtualId;
    setAplicandoAssinaturaId(chave);
    setErro(null);
    setSucesso(null);
    try {
      const assinatura = await executarAutenticado(() =>
        aplicarPlanoAssinatura({
          planoId,
          status: 'ativa',
          observacao: `Solicitacao ${solicitacao.acao} aplicada pelo painel operacional.`
        })
      );
      if (assinatura) {
        await recarregarSolicitacoesAssinatura({ preservarMensagem: true });
        setSucesso(`Plano ${assinatura.plano} aplicado para ${assinatura.tenantId}.`);
      }
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao aplicar plano de assinatura.');
    } finally {
      setAplicandoAssinaturaId(null);
    }
  }

  async function filtrarLgpd(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!sessao) return;

    const { signal, ehAtual } = iniciarRequisicaoLgpd();
    setCarregandoLgpd(true);
    setErro(null);
    setSucesso(null);
    try {
      const solicitacoesLgpd = await executarAutenticado(() => carregarSolicitacoesLgpd({ ...filtrosLgpd, pagina: 1 }, { signal }));
      if (!ehAtual()) return;
      if (solicitacoesLgpd) {
        setFiltrosLgpd((atual) => ({ ...atual, pagina: solicitacoesLgpd.pagina }));
        setDados((dadosAtuais) => (dadosAtuais ? { ...dadosAtuais, solicitacoesLgpd } : dadosAtuais));
      }
    } catch (erroAtual) {
      if (!ehAtual()) return;
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar solicitacoes LGPD.');
    } finally {
      if (ehAtual()) setCarregandoLgpd(false);
    }
  }

  async function trocarPaginaLgpd(proximaPagina: number) {
    if (!sessao || proximaPagina < 1) return;

    const { signal, ehAtual } = iniciarRequisicaoLgpd();
    setCarregandoLgpd(true);
    setErro(null);
    setSucesso(null);
    try {
      const solicitacoesLgpd = await executarAutenticado(() =>
        carregarSolicitacoesLgpd({ ...filtrosLgpd, pagina: proximaPagina }, { signal })
      );
      if (!ehAtual()) return;
      if (solicitacoesLgpd) {
        setFiltrosLgpd((atual) => ({ ...atual, pagina: solicitacoesLgpd.pagina }));
        setDados((dadosAtuais) => (dadosAtuais ? { ...dadosAtuais, solicitacoesLgpd } : dadosAtuais));
      }
    } catch (erroAtual) {
      if (!ehAtual()) return;
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao paginar solicitacoes LGPD.');
    } finally {
      if (ehAtual()) setCarregandoLgpd(false);
    }
  }

  async function atualizarLgpd(protocolo: string, status: Exclude<StatusSolicitacaoLgpd, 'recebida'>) {
    if (!sessao) return;

    setAtualizandoLgpdProtocolo(protocolo);
    setErro(null);
    setSucesso(null);
    try {
      const solicitacao = await executarAutenticado(() =>
        atualizarSolicitacaoLgpd(protocolo, {
          status,
          detalhes: status === 'em_tratamento' ? 'Em atendimento.' : undefined
        })
      );
      if (solicitacao) {
        setDados((dadosAtuais) =>
          dadosAtuais
            ? {
                ...dadosAtuais,
                solicitacoesLgpd: {
                  ...dadosAtuais.solicitacoesLgpd,
                  itens: dadosAtuais.solicitacoesLgpd.itens.map((item) =>
                    item.protocolo === solicitacao.protocolo ? solicitacao : item
                  )
                }
              }
            : dadosAtuais
        );
        setSucesso(`Solicitacao LGPD atualizada: ${solicitacao.protocolo}.`);
        if (detalheLgpd?.protocolo === solicitacao.protocolo) {
          await carregarDetalheLgpd(solicitacao.protocolo, { preservarMensagem: true });
        }
      }
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao atualizar solicitacao LGPD.');
    } finally {
      setAtualizandoLgpdProtocolo(null);
    }
  }

  async function carregarDetalheLgpd(protocolo: string, opcoes: { preservarMensagem?: boolean } = {}) {
    if (!sessao) return;

    const { signal, ehAtual } = iniciarRequisicaoDetalheLgpd();
    setCarregandoDetalheLgpd(true);
    setErro(null);
    if (!opcoes.preservarMensagem) setSucesso(null);
    try {
      const detalhe = await executarAutenticado(() => obterDetalheSolicitacaoLgpd(protocolo, { signal }));
      if (!ehAtual()) return;
      if (detalhe) {
        setDetalheLgpd(detalhe);
        setRespostaLgpd(null);
      }
    } catch (erroAtual) {
      if (!ehAtual()) return;
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar detalhe LGPD.');
    } finally {
      if (ehAtual()) setCarregandoDetalheLgpd(false);
    }
  }

  function exportarSolicitacaoLgpd(protocolo: string) {
    window.location.href = urlExportacaoSolicitacaoLgpd(protocolo);
  }

  async function prepararRespostaLgpd(protocolo: string) {
    if (!sessao) return;

    setPreparandoRespostaProtocolo(protocolo);
    setErro(null);
    setSucesso(null);
    try {
      const resposta = await executarAutenticado(() => prepararRespostaSolicitacaoLgpd(protocolo));
      if (resposta) {
        setRespostaLgpd(resposta);
        setSucesso(`Resposta LGPD preparada para ${resposta.protocolo}.`);
      }
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao preparar resposta LGPD.');
    } finally {
      setPreparandoRespostaProtocolo(null);
    }
  }

  async function copiarRespostaLgpd(resposta: RespostaSolicitacaoLgpdOperacional) {
    const texto = [
      `Assunto: ${resposta.assuntoEmail}`,
      '',
      resposta.corpoEmail,
      '',
      `WhatsApp: ${resposta.textoWhatsapp}`
    ].join('\n');

    try {
      await navigator.clipboard?.writeText(texto);
      setSucesso(`Resposta LGPD copiada para ${resposta.protocolo}.`);
    } catch {
      setSucesso(`Resposta LGPD copiada para ${resposta.protocolo}.`);
    }
  }

  async function programarRetencaoLgpd() {
    if (!sessao) return;

    setProgramandoRetencao(true);
    setErro(null);
    setSucesso(null);
    try {
      const programacao = await executarAutenticado(programarRetencaoDadosOperacional);
      if (programacao) {
        const retencaoDados = await executarAutenticado(carregarRetencaoDadosOperacional);
        setDados((dadosAtuais) => (dadosAtuais && retencaoDados ? { ...dadosAtuais, retencaoDados } : dadosAtuais));
        setSucesso(`Retencao LGPD programada: ${programacao.protocolo}.`);
      }
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao programar retencao LGPD.');
    } finally {
      setProgramandoRetencao(false);
    }
  }

  function exportarAuditoria() {
    window.location.href = urlExportacaoAuditoria(filtrosAuditoria);
  }

  function exportarOutbox() {
    window.location.href = urlExportacaoFalhasOutbox(filtrosOutbox);
  }

  async function encerrarSessao() {
    await sair();
    router.replace('/login?redirect=/operacoes');
  }

  useEffect(() => {
    void obterSessao().then((sessaoAtual) => {
      if (!sessaoAtual) {
        redirecionarParaLogin();
        return;
      }

      setSessao(sessaoAtual);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- redirecionarParaLogin nao e useCallback; incluir recriaria o efeito a cada render
  }, [router]);

  useEffect(() => {
    if (sessao) {
      void carregar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carregar nao e useCallback; so deve rodar quando a sessao mudar
  }, [sessao]);

  const metricas = [
    { rotulo: 'Pendentes', valor: dados?.resumo.outbox.pendente ?? 0, icone: RefreshCcw, cor: 'text-primaria' },
    { rotulo: 'Processando', valor: dados?.resumo.outbox.processando ?? 0, icone: Activity, cor: 'text-alerta' },
    { rotulo: 'Processados', valor: dados?.resumo.outbox.processado ?? 0, icone: CheckCircle2, cor: 'text-sucesso' },
    { rotulo: 'Falharam', valor: dados?.resumo.outbox.falhou ?? 0, icone: AlertTriangle, cor: 'text-perigo' }
  ];
  const auditoriaPaginada = dados?.auditoriaPaginada;
  const falhasPaginadas = dados?.falhasPaginadas;
  const falhasComunicacao = dados?.falhasComunicacao;
  const totalPaginasAuditoria = auditoriaPaginada ? Math.max(Math.ceil(auditoriaPaginada.total / auditoriaPaginada.limite), 1) : 1;
  const totalPaginasOutbox = falhasPaginadas ? Math.max(Math.ceil(falhasPaginadas.total / falhasPaginadas.limite), 1) : 1;
  const totalPaginasFalhasComunicacao = falhasComunicacao
    ? Math.max(Math.ceil(falhasComunicacao.total / falhasComunicacao.limite), 1)
    : 1;
  const solicitacoesAssinatura = dados?.solicitacoesAssinatura;
  const solicitacoesLgpd = dados?.solicitacoesLgpd;
  const retencaoDados = dados?.retencaoDados;
  const alertasOperacionais = dados?.alertasOperacionais;
  const totalPaginasLgpd = solicitacoesLgpd ? Math.max(Math.ceil(solicitacoesLgpd.total / solicitacoesLgpd.limite), 1) : 1;

  return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Cartao>
        <CartaoConteudo className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold">{sessao?.email ?? 'Carregando sessao'}</p>
            <p className="mt-1 text-xs text-texto-suave">
              {sessao ? `${sessao.tenantSlug} em ${sessao.apiUrl}` : 'Validando acesso operacional'}
            </p>
          </div>
          <Botao onClick={encerrarSessao} variante="fantasma">
            Sair
          </Botao>
          <Botao variante="primario" onClick={carregar} disabled={carregando}>
            <RefreshCcw size={16} />
            {carregando ? 'Atualizando' : 'Atualizar'}
          </Botao>
        </CartaoConteudo>
        </Cartao>

        {erro ? <AlertaOperacional mensagem={erro} /> : null}
        {sucesso ? (
          <div role="status" className="rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso">
            {sucesso}
          </div>
        ) : null}
        <BarraCarregamento
          visivel={
            carregando ||
            carregandoAuditoria ||
            carregandoAssinatura ||
            carregandoLgpd ||
            carregandoDetalheLgpd ||
            Boolean(reprocessandoComunicacaoId) ||
            Boolean(preparandoRespostaProtocolo) ||
            programandoRetencao
          }
        />

        <Abas
          identificador="operacoes"
          abas={areasOperacoes}
          ativaId={areaAtiva}
          aoMudar={(id) => setAreaAtiva(id as AreaOperacoes)}
          rotulo="Areas de operacoes"
        />

        <section
          id="operacoes-saude-painel"
          role="tabpanel"
          aria-labelledby="operacoes-saude-aba"
          hidden={areaAtiva !== 'saude'}
          className="grid gap-3 md:grid-cols-4"
        >
          {metricas.map((item) => (
            <Cartao key={item.rotulo}>
              <CartaoConteudo>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-texto-suave">{item.rotulo}</span>
                  <item.icone className={item.cor} size={20} />
                </div>
                <p className="mt-3 text-3xl font-bold">{item.valor}</p>
              </CartaoConteudo>
            </Cartao>
          ))}
        </section>

        <Cartao
          id="operacoes-incidentes-painel"
          role="tabpanel"
          aria-labelledby="operacoes-incidentes-aba"
          hidden={areaAtiva !== 'incidentes'}
        >
          <CartaoCabecalho className="flex-col items-start md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle size={19} className={alertasOperacionais?.status === 'critico' ? 'text-perigo' : 'text-alerta'} />
                <h2 className="text-base font-semibold">Alertas operacionais</h2>
                <span className="text-sm text-texto-suave">{alertasOperacionais?.resumo.total ?? 0} ativos</span>
              </div>
              <p className="mt-1 text-xs text-texto-suave">
                Criticos {alertasOperacionais?.resumo.criticos ?? 0} | Atencao {alertasOperacionais?.resumo.atencao ?? 0} | Informativos{' '}
                {alertasOperacionais?.resumo.informativos ?? 0}
              </p>
            </div>
            <span className="rounded-sm bg-superficie-hover px-2 py-1 text-xs font-semibold text-primaria">
              {rotuloStatusAlertas(alertasOperacionais?.status ?? 'ok')}
            </span>
          </CartaoCabecalho>
          {alertasOperacionais?.itens.length ? (
            <div className="grid gap-3 p-4 md:grid-cols-2">
              {alertasOperacionais.itens.slice(0, 6).map((alerta) => (
                <article key={alerta.id} className={`rounded-lg border p-3 ${classeSeveridadeAlerta(alerta.severidade)}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">{alerta.titulo}</h3>
                      <p className="mt-1 text-xs">{alerta.mensagem}</p>
                    </div>
                    <span className="shrink-0 rounded-sm bg-white/70 px-2 py-1 text-[11px] font-semibold uppercase">
                      {alerta.severidade}
                    </span>
                  </div>
                  <p className="mt-2 text-xs">{alerta.acaoSugerida}</p>
                  {typeof alerta.valor === 'number' ? <p className="mt-2 text-xs font-semibold">Valor: {alerta.valor}</p> : null}
                </article>
              ))}
            </div>
          ) : (
            <EstadoVazio titulo="Nenhum alerta ativo" descricao="Health, filas e integracoes sem alerta operacional no momento." />
          )}
        </Cartao>

        <Cartao
          id="operacoes-comunicacoes-painel"
          role="tabpanel"
          aria-labelledby="operacoes-comunicacoes-aba"
          hidden={areaAtiva !== 'comunicacoes'}
        >
          <CartaoCabecalho className="flex-col items-start md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2">
                <AlertTriangle size={19} className="text-perigo" />
                <h2 className="text-base font-semibold">Central de comunicacao</h2>
                <span className="text-sm text-texto-suave">{falhasComunicacao?.total ?? 0} falhas</span>
              </div>
              <p className="mt-1 text-xs text-texto-suave">
                E-mail {falhasComunicacao?.resumo.email ?? 0} | WhatsApp {falhasComunicacao?.resumo.whatsapp ?? 0} | Google Calendar{' '}
                {falhasComunicacao?.resumo.googleCalendar ?? 0} | Outbox {falhasComunicacao?.resumo.outbox ?? 0}
              </p>
            </div>
            <span className="rounded-sm bg-superficie-hover px-2 py-1 text-xs font-semibold text-primaria">
              {falhasComunicacao?.resumo.reprocessaveis ?? 0} reprocessaveis
            </span>
          </CartaoCabecalho>
          <form onSubmit={filtrarFalhasComunicacao} className="grid gap-2 border-b border-linha px-4 py-3 lg:grid-cols-[0.8fr_0.8fr_1fr_1fr_1fr_auto]">
            <select
              className="h-9 rounded-md border border-linha px-2 text-sm"
              value={filtrosFalhasComunicacao.origem}
              onChange={(evento) =>
                setFiltrosFalhasComunicacao((atual) => ({ ...atual, origem: evento.target.value as FiltrosFalhasComunicacao['origem'] }))
              }
              aria-label="Origem da falha"
            >
              <option value="">Origem</option>
              <option value="mensagem">Mensagem</option>
              <option value="outbox">Outbox</option>
              <option value="google_calendar">Google Calendar</option>
            </select>
            <select
              className="h-9 rounded-md border border-linha px-2 text-sm"
              value={filtrosFalhasComunicacao.canal}
              onChange={(evento) =>
                setFiltrosFalhasComunicacao((atual) => ({ ...atual, canal: evento.target.value as FiltrosFalhasComunicacao['canal'] }))
              }
              aria-label="Canal da falha"
            >
              <option value="">Canal</option>
              <option value="email">E-mail</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="google_calendar">Google Calendar</option>
              <option value="outbox">Outbox</option>
            </select>
            <input
              className="h-9 rounded-md border border-linha px-2 text-sm"
              placeholder="Tipo/evento"
              value={filtrosFalhasComunicacao.tipo}
              onChange={(evento) => setFiltrosFalhasComunicacao((atual) => ({ ...atual, tipo: evento.target.value }))}
            />
            <input
              type="datetime-local"
              className="h-9 rounded-md border border-linha px-2 text-sm"
              value={filtrosFalhasComunicacao.inicio}
              onChange={(evento) => setFiltrosFalhasComunicacao((atual) => ({ ...atual, inicio: evento.target.value }))}
              aria-label="Inicio falhas comunicacao"
            />
            <input
              type="datetime-local"
              className="h-9 rounded-md border border-linha px-2 text-sm"
              value={filtrosFalhasComunicacao.fim}
              onChange={(evento) => setFiltrosFalhasComunicacao((atual) => ({ ...atual, fim: evento.target.value }))}
              aria-label="Fim falhas comunicacao"
            />
            <Botao type="submit" disabled={carregando}>
              <Search size={16} />
              Filtrar
            </Botao>
          </form>
          <div className="divide-y divide-linha">
            {falhasComunicacao?.itens.length ? (
              falhasComunicacao.itens.map((falha) => (
                <div key={falha.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1fr_0.8fr_auto] lg:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm">{falha.tipo}</strong>
                      <span className="rounded-sm bg-perigo-suave px-2 py-1 text-xs font-semibold text-perigo">
                        {rotuloCanalFalha(falha.canal)}
                      </span>
                      <span className="rounded-sm bg-superficie-hover px-2 py-1 text-xs font-semibold text-primaria">
                        {rotuloOrigemFalha(falha.origem)}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-sm text-texto-suave">{falha.erro ?? 'Erro nao informado'}</p>
                    <p className="mt-1 break-all text-xs text-texto-suave">{falha.resumo ?? falha.referenciaId}</p>
                  </div>
                  <div className="text-xs text-texto-suave">
                    <p className="break-all">Referencia: {falha.referenciaId}</p>
                    <p className="mt-1">Criado em {formatarData(falha.criadoEm)}</p>
                    {falha.tentativas !== undefined ? <p className="mt-1">{falha.tentativas} tentativas</p> : null}
                  </div>
                  <Botao
                    type="button"
                    onClick={() => void reprocessarComunicacao(falha.id)}
                    disabled={!falha.reprocessavel || reprocessandoComunicacaoId === falha.id}
                  >
                    <Undo2 size={16} />
                    {reprocessandoComunicacaoId === falha.id ? 'Enviando' : 'Reprocessar'}
                  </Botao>
                </div>
              ))
            ) : (
              <EstadoVazio titulo="Nenhuma falha de comunicacao carregada." />
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-linha px-4 py-3 md:flex-row md:items-center md:justify-between">
            <span className="text-sm text-texto-suave">
              Pagina {falhasComunicacao?.pagina ?? 1} de {totalPaginasFalhasComunicacao} | {falhasComunicacao?.total ?? 0} falhas
            </span>
            <div className="flex gap-2">
              <Botao
                type="button"
                onClick={() => void trocarPaginaFalhasComunicacao((falhasComunicacao?.pagina ?? 1) - 1)}
                disabled={!falhasComunicacao || falhasComunicacao.pagina <= 1 || carregando}
              >
                Anterior
              </Botao>
              <Botao
                type="button"
                onClick={() => void trocarPaginaFalhasComunicacao((falhasComunicacao?.pagina ?? 1) + 1)}
                disabled={!falhasComunicacao || falhasComunicacao.pagina >= totalPaginasFalhasComunicacao || carregando}
              >
                Proxima
              </Botao>
            </div>
          </div>
        </Cartao>

        <Cartao hidden={areaAtiva !== 'filas'}>
          <CartaoCabecalho>
            <div className="flex items-center gap-2">
              <CreditCard size={19} className="text-primaria" />
              <h2 className="text-base font-semibold">Assinaturas</h2>
              <span className="text-sm text-texto-suave">{solicitacoesAssinatura?.total ?? 0} solicitacoes</span>
            </div>
            <Botao type="button" onClick={() => void recarregarSolicitacoesAssinatura()} disabled={carregandoAssinatura}>
              <RefreshCcw size={16} />
              {carregandoAssinatura ? 'Atualizando' : 'Atualizar fila'}
            </Botao>
          </CartaoCabecalho>
          <div className="divide-y divide-linha">
            {solicitacoesAssinatura?.itens.length ? (
              solicitacoesAssinatura.itens.map((solicitacao) => {
                const chave = chaveSolicitacaoAssinatura(solicitacao);
                const planoDestino = solicitacao.planoDesejado ?? solicitacao.planoAtualId;

                return (
                  <div key={chave} className="grid gap-3 px-4 py-4 lg:grid-cols-[0.8fr_0.8fr_1fr_auto] lg:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm">{solicitacao.acao}</strong>
                        <span className={`rounded-sm px-2 py-1 text-xs font-semibold ${classeStatusAssinatura(solicitacao.status)}`}>
                          {rotuloStatusAssinatura(solicitacao.status)}
                        </span>
                      </div>
                      <p className="mt-1 break-all text-xs text-texto-suave">Tenant: {solicitacao.tenantId}</p>
                      <p className="mt-1 text-xs text-texto-suave">{formatarData(solicitacao.solicitadoEm)}</p>
                    </div>
                    <div className="text-sm">
                      <p>
                        <span className="text-texto-suave">Atual: </span>
                        <strong>{solicitacao.planoAtual || rotuloPlano(solicitacao.planoAtualId)}</strong>
                      </p>
                      <p className="mt-1">
                        <span className="text-texto-suave">Desejado: </span>
                        <strong>{rotuloPlano(planoDestino)}</strong>
                      </p>
                    </div>
                    <div className="text-sm text-tinta">
                      <p>{solicitacao.observacao ?? 'Sem observacao comercial.'}</p>
                      {solicitacao.resolvidoEm ? (
                        <p className="mt-1 text-xs text-texto-suave">Resolvido em {formatarData(solicitacao.resolvidoEm)}</p>
                      ) : null}
                    </div>
                    <div className="flex justify-start lg:justify-end">
                      {solicitacao.status === 'pendente' ? (
                        <Botao
                          type="button"
                          variante="primario"
                          onClick={() => void aplicarPlanoSolicitacao(solicitacao)}
                          disabled={aplicandoAssinaturaId === chave}
                        >
                          <CreditCard size={16} />
                          {aplicandoAssinaturaId === chave ? 'Aplicando' : `Aplicar ${rotuloPlano(planoDestino)}`}
                        </Botao>
                      ) : (
                        <span className="rounded-sm bg-superficie-hover px-2 py-1 text-xs font-semibold text-primaria">
                          {solicitacao.planoAplicadoId ? `Plano ${rotuloPlano(solicitacao.planoAplicadoId)}` : 'Sem acao pendente'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <EstadoVazio titulo="Nenhuma solicitacao de assinatura carregada." />
            )}
          </div>
        </Cartao>

        <Cartao
          id="operacoes-lgpd-painel"
          role="tabpanel"
          aria-labelledby="operacoes-lgpd-aba"
          hidden={areaAtiva !== 'lgpd'}
        >
          <CartaoCabecalho className="flex-col items-start lg:flex-row lg:items-center">
            <div className="flex items-center gap-2">
              <Scale size={19} className="text-primaria" />
              <h2 className="text-base font-semibold">Solicitacoes LGPD</h2>
              <span className="text-sm text-texto-suave">{solicitacoesLgpd?.total ?? 0} protocolos</span>
            </div>
            <form onSubmit={filtrarLgpd} className="grid gap-2 md:grid-cols-3">
              <select
                className="h-9 rounded-md border border-linha bg-white px-2 text-sm"
                value={filtrosLgpd.status}
                onChange={(evento) => setFiltrosLgpd((atual) => ({ ...atual, status: evento.target.value as FiltrosSolicitacoesLgpd['status'] }))}
                aria-label="Status LGPD"
              >
                <option value="">Todos os status</option>
                <option value="recebida">Recebida</option>
                <option value="em_tratamento">Em tratamento</option>
                <option value="concluida">Concluida</option>
                <option value="indeferida">Indeferida</option>
              </select>
              <select
                className="h-9 rounded-md border border-linha bg-white px-2 text-sm"
                value={filtrosLgpd.tipo}
                onChange={(evento) => setFiltrosLgpd((atual) => ({ ...atual, tipo: evento.target.value as FiltrosSolicitacoesLgpd['tipo'] }))}
                aria-label="Tipo LGPD"
              >
                <option value="">Todos os tipos</option>
                <option value="retificacao">Retificacao</option>
                <option value="exclusao">Exclusao</option>
              </select>
              <Botao type="submit" disabled={carregandoLgpd}>
                <Search size={16} />
                {carregandoLgpd ? 'Filtrando' : 'Filtrar'}
              </Botao>
            </form>
          </CartaoCabecalho>
          <div className="border-b border-linha bg-superficie px-4 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-base font-semibold">Retencao e exclusao programada</h3>
                <p className="mt-1 text-sm text-texto-suave">
                  {pluralizarItensRetencao(retencaoDados?.resumo.totalVencidos ?? 0)} | Politica {retencaoDados?.versao ?? '-'}
                </p>
              </div>
              <Botao type="button" variante="primario" onClick={() => void programarRetencaoLgpd()} disabled={programandoRetencao}>
                <History size={16} />
                {programandoRetencao ? 'Programando' : 'Programar retencao LGPD'}
              </Botao>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {retencaoDados?.resumo.itens.length ? (
                retencaoDados.resumo.itens.map((item) => {
                  const politica = retencaoDados.politicas.find((politicaAtual) => politicaAtual.id === item.politicaId);

                  return (
                    <article key={item.politicaId} className="rounded-md border border-linha bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm">{item.rotulo}</strong>
                        <span className="rounded-sm bg-superficie-hover px-2 py-1 text-xs font-semibold text-primaria">
                          {rotuloAcaoRetencao(item.acao)}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-tinta">{politica?.descricao ?? 'Politica operacional cadastrada.'}</p>
                      <p className="mt-2 text-xs text-texto-suave">
                        {item.vencidos} vencidos desde {formatarData(item.corteEm)} | {item.diasRetencao} dias
                      </p>
                    </article>
                  );
                })
              ) : (
                <EstadoVazio titulo="Nenhuma politica de retencao carregada." />
              )}
            </div>
          </div>
          <div className="divide-y divide-linha">
            {solicitacoesLgpd?.itens.length ? (
              solicitacoesLgpd.itens.map((solicitacao) => (
                <div key={solicitacao.protocolo} className="grid gap-3 px-4 py-4 lg:grid-cols-[0.9fr_1fr_0.75fr_auto] lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm">{solicitacao.protocolo}</strong>
                      <span className={`rounded-sm px-2 py-1 text-xs font-semibold ${classeStatusLgpd(solicitacao.status)}`}>
                        {rotuloStatusLgpd(solicitacao.status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-texto-suave">{rotuloTipoLgpd(solicitacao.tipo)}</p>
                    <p className="mt-1 break-all text-xs text-texto-suave">Paciente: {solicitacao.pacienteId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-tinta">{solicitacao.detalhes ?? 'Sem detalhes informados.'}</p>
                    <p className="mt-1 text-xs text-texto-suave">
                      Ultima tratativa: {solicitacao.ultimaTratativa ?? 'Sem tratativa registrada.'}
                    </p>
                  </div>
                  <div className="text-xs text-texto-suave">
                    <p>Aberta: {formatarData(solicitacao.abertoEm)}</p>
                    <p className="mt-1">Atualizada: {formatarData(solicitacao.atualizadoEm)}</p>
                    <p className="mt-1 break-all">Responsavel: {solicitacao.responsavelId ?? '-'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Botao
                      type="button"
                      onClick={() => void carregarDetalheLgpd(solicitacao.protocolo)}
                      disabled={carregandoDetalheLgpd && detalheLgpd?.protocolo === solicitacao.protocolo}
                      aria-label={`Ver detalhes ${solicitacao.protocolo}`}
                    >
                      {carregandoDetalheLgpd && detalheLgpd?.protocolo === solicitacao.protocolo ? 'Carregando' : 'Ver detalhes'}
                    </Botao>
                    {solicitacao.status === 'recebida' ? (
                      <Botao
                        type="button"
                        onClick={() => void atualizarLgpd(solicitacao.protocolo, 'em_tratamento')}
                        disabled={atualizandoLgpdProtocolo === solicitacao.protocolo}
                      >
                        {atualizandoLgpdProtocolo === solicitacao.protocolo ? 'Atualizando' : 'Iniciar tratativa'}
                      </Botao>
                    ) : null}
                    {solicitacao.status !== 'concluida' ? (
                      <Botao
                        type="button"
                        variante="primario"
                        onClick={() => void atualizarLgpd(solicitacao.protocolo, 'concluida')}
                        disabled={atualizandoLgpdProtocolo === solicitacao.protocolo}
                      >
                        Concluir
                      </Botao>
                    ) : null}
                    {solicitacao.status !== 'indeferida' && solicitacao.status !== 'concluida' ? (
                      <Botao
                        type="button"
                        variante="perigo"
                        onClick={() => void atualizarLgpd(solicitacao.protocolo, 'indeferida')}
                        disabled={atualizandoLgpdProtocolo === solicitacao.protocolo}
                      >
                        Indeferir
                      </Botao>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <EstadoVazio titulo="Nenhuma solicitacao LGPD carregada." />
            )}
          </div>
          {detalheLgpd ? (
            <div className="border-t border-linha bg-superficie px-4 py-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-base font-semibold">Detalhe do protocolo {detalheLgpd.protocolo}</h3>
                  <p className="mt-1 text-sm text-texto-suave">
                    {rotuloTipoLgpd(detalheLgpd.tipo)} | {rotuloStatusLgpd(detalheLgpd.status)} | Paciente {detalheLgpd.pacienteId}
                  </p>
                </div>
                <Botao
                  type="button"
                  onClick={() => exportarSolicitacaoLgpd(detalheLgpd.protocolo)}
                  aria-label={`Exportar protocolo ${detalheLgpd.protocolo}`}
                >
                  <Download size={16} />
                  CSV
                </Botao>
                <Botao
                  type="button"
                  variante="primario"
                  onClick={() => void prepararRespostaLgpd(detalheLgpd.protocolo)}
                  disabled={preparandoRespostaProtocolo === detalheLgpd.protocolo}
                  aria-label={`Preparar resposta ${detalheLgpd.protocolo}`}
                >
                  {preparandoRespostaProtocolo === detalheLgpd.protocolo ? 'Preparando' : 'Preparar resposta'}
                </Botao>
              </div>
              <div className="mt-4 grid gap-3">
                {detalheLgpd.historico.map((evento) => (
                  <article key={evento.id} className="rounded-md border border-linha bg-white p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-sm">{evento.tipo}</strong>
                        <span className={`rounded-sm px-2 py-1 text-xs font-semibold ${classeStatusLgpd(evento.status)}`}>
                          {rotuloStatusLgpd(evento.status)}
                        </span>
                      </div>
                      <span className="text-xs text-texto-suave">{formatarData(evento.criadoEm)}</span>
                    </div>
                    <p className="mt-2 text-sm text-tinta">{evento.detalhes ?? 'Sem detalhes.'}</p>
                    <p className="mt-1 break-all text-xs text-texto-suave">Responsavel: {evento.responsavelId ?? '-'}</p>
                  </article>
                ))}
              </div>
              {respostaLgpd ? (
                <div className="mt-4 rounded-md border border-linha bg-white p-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-base font-semibold">Resposta ao paciente</h3>
                      <p className="mt-1 text-xs text-texto-suave">
                        Canais sugeridos: {respostaLgpd.canaisSugeridos.join(', ')}
                      </p>
                    </div>
                    <Botao
                      type="button"
                      onClick={() => void copiarRespostaLgpd(respostaLgpd)}
                      aria-label={`Copiar resposta ${respostaLgpd.protocolo}`}
                    >
                      Copiar resposta
                    </Botao>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-md border border-linha bg-superficie p-3">
                      <p className="text-xs font-semibold text-texto-suave">Email</p>
                      <p className="mt-1 text-sm font-semibold">{respostaLgpd.assuntoEmail}</p>
                      <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-texto-suave">{respostaLgpd.corpoEmail}</pre>
                    </div>
                    <div className="rounded-md border border-linha bg-superficie p-3">
                      <p className="text-xs font-semibold text-texto-suave">WhatsApp</p>
                      <p className="mt-2 break-words text-sm text-tinta">{respostaLgpd.textoWhatsapp}</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-col gap-2 border-t border-linha px-4 py-3 md:flex-row md:items-center md:justify-between">
            <span className="text-sm text-texto-suave">
              Pagina {solicitacoesLgpd?.pagina ?? 1} de {totalPaginasLgpd} | {solicitacoesLgpd?.total ?? 0} protocolos
            </span>
            <div className="flex gap-2">
              <Botao
                type="button"
                onClick={() => void trocarPaginaLgpd((solicitacoesLgpd?.pagina ?? 1) - 1)}
                disabled={!solicitacoesLgpd || solicitacoesLgpd.pagina <= 1 || carregandoLgpd}
              >
                Anterior
              </Botao>
              <Botao
                type="button"
                onClick={() => void trocarPaginaLgpd((solicitacoesLgpd?.pagina ?? 1) + 1)}
                disabled={!solicitacoesLgpd || solicitacoesLgpd.pagina >= totalPaginasLgpd || carregandoLgpd}
              >
                Proxima
              </Botao>
            </div>
          </div>
        </Cartao>

        <Cartao
          id="operacoes-auditoria-painel"
          role="tabpanel"
          aria-labelledby="operacoes-auditoria-aba"
          hidden={areaAtiva !== 'auditoria'}
        >
          <CartaoCabecalho className="flex-col items-start lg:flex-row lg:items-center">
            <div className="flex items-center gap-2">
              <History size={19} className="text-primaria" />
              <h2 className="text-base font-semibold">Auditoria sensivel</h2>
              <span className="text-sm text-texto-suave">{dados?.auditoria.length ?? 0} eventos</span>
            </div>
            <form onSubmit={filtrarAuditoria} className="grid gap-2 md:grid-cols-3 lg:grid-cols-8">
              <select
                className="h-9 rounded-md border border-linha bg-white px-2 text-sm"
                value={filtrosAuditoria.acao}
                onChange={(evento) => setFiltrosAuditoria((atual) => ({ ...atual, acao: evento.target.value }))}
                aria-label="Acao"
              >
                <option value="">Todas as acoes</option>
                <option value="pacientes.listar_dados_sensiveis">Pacientes - listar</option>
                <option value="pacientes.obter_dados_sensiveis">Pacientes - detalhe</option>
                <option value="profissionais.listar_dados_sensiveis">Profissionais - listar</option>
                <option value="profissionais.obter_dados_sensiveis">Profissionais - detalhe</option>
              </select>
              <input
                className="h-9 rounded-md border border-linha px-2 text-sm"
                placeholder="Recurso"
                value={filtrosAuditoria.recursoTipo}
                onChange={(evento) => setFiltrosAuditoria((atual) => ({ ...atual, recursoTipo: evento.target.value }))}
              />
              <input
                className="h-9 rounded-md border border-linha px-2 text-sm"
                placeholder="ID recurso"
                value={filtrosAuditoria.recursoId}
                onChange={(evento) => setFiltrosAuditoria((atual) => ({ ...atual, recursoId: evento.target.value }))}
              />
              <input
                className="h-9 rounded-md border border-linha px-2 text-sm"
                placeholder="ID usuario"
                value={filtrosAuditoria.usuarioId}
                onChange={(evento) => setFiltrosAuditoria((atual) => ({ ...atual, usuarioId: evento.target.value }))}
              />
              <input
                type="datetime-local"
                className="h-9 rounded-md border border-linha px-2 text-sm"
                value={filtrosAuditoria.inicio}
                onChange={(evento) => setFiltrosAuditoria((atual) => ({ ...atual, inicio: evento.target.value }))}
                aria-label="Inicio"
              />
              <input
                type="datetime-local"
                className="h-9 rounded-md border border-linha px-2 text-sm"
                value={filtrosAuditoria.fim}
                onChange={(evento) => setFiltrosAuditoria((atual) => ({ ...atual, fim: evento.target.value }))}
                aria-label="Fim"
              />
              <Botao type="submit" disabled={carregandoAuditoria}>
                <Search size={16} />
                {carregandoAuditoria ? 'Filtrando' : 'Filtrar'}
              </Botao>
              <Botao type="button" onClick={exportarAuditoria} disabled={!dados?.auditoria.length}>
                <Download size={16} />
                CSV
              </Botao>
            </form>
          </CartaoCabecalho>
          <div className="divide-y divide-linha">
            {dados?.auditoria.length ? (
              dados.auditoria.map((evento) => (
                <div key={evento.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.1fr_0.9fr_0.8fr]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm">{evento.acao}</strong>
                      <span className="rounded-sm bg-superficie-hover px-2 py-1 text-xs font-semibold text-primaria">
                        {evento.recursoTipo ?? 'recurso'}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-xs text-texto-suave">{evento.recursoId ?? '-'}</p>
                    <p className="mt-1 text-xs text-texto-suave">{formatarData(evento.criadoEm)}</p>
                  </div>
                  <div className="text-xs text-texto-suave">
                    <p className="break-all">Usuario: {evento.usuarioId ?? '-'}</p>
                    <p className="mt-1 break-all">IP: {evento.ip ?? '-'}</p>
                    <p className="mt-1 break-all">Agent: {evento.userAgent ?? '-'}</p>
                  </div>
                  <p className="break-all text-xs text-texto-suave">{resumirMetadados(evento.metadados)}</p>
                </div>
              ))
            ) : (
              <EstadoVazio titulo="Nenhum evento de auditoria carregado." />
            )}
          </div>
          <div className="flex flex-col gap-2 border-t border-linha px-4 py-3 md:flex-row md:items-center md:justify-between">
            <span className="text-sm text-texto-suave">
              Pagina {auditoriaPaginada?.pagina ?? 1} de {totalPaginasAuditoria} | {auditoriaPaginada?.total ?? 0} eventos
            </span>
            <div className="flex gap-2">
              <Botao
                type="button"
                onClick={() => void trocarPaginaAuditoria((auditoriaPaginada?.pagina ?? 1) - 1)}
                disabled={!auditoriaPaginada || auditoriaPaginada.pagina <= 1 || carregandoAuditoria}
              >
                Anterior
              </Botao>
              <Botao
                type="button"
                onClick={() => void trocarPaginaAuditoria((auditoriaPaginada?.pagina ?? 1) + 1)}
                disabled={!auditoriaPaginada || auditoriaPaginada.pagina >= totalPaginasAuditoria || carregandoAuditoria}
              >
                Proxima
              </Botao>
            </div>
          </div>
        </Cartao>

        <section
          id="operacoes-filas-painel"
          role="tabpanel"
          aria-labelledby="operacoes-filas-aba"
          hidden={areaAtiva !== 'filas'}
          className="grid gap-5 lg:grid-cols-[1.35fr_0.9fr]"
        >
          <Cartao>
            <CartaoCabecalho>
              <div>
                <h2 className="text-base font-semibold">Outbox com falha</h2>
                <span className="text-sm text-texto-suave">{falhasPaginadas?.total ?? dados?.falhas.length ?? 0} eventos</span>
              </div>
              <Botao type="button" onClick={exportarOutbox} disabled={!dados?.falhas.length}>
                <Download size={16} />
                CSV
              </Botao>
            </CartaoCabecalho>
            <form onSubmit={filtrarOutbox} className="grid gap-2 border-b border-linha px-4 py-3 md:grid-cols-4">
              <input
                className="h-9 rounded-md border border-linha px-2 text-sm"
                placeholder="Tipo"
                value={filtrosOutbox.tipo}
                onChange={(evento) => setFiltrosOutbox((atual) => ({ ...atual, tipo: evento.target.value }))}
              />
              <input
                type="datetime-local"
                className="h-9 rounded-md border border-linha px-2 text-sm"
                value={filtrosOutbox.inicio}
                onChange={(evento) => setFiltrosOutbox((atual) => ({ ...atual, inicio: evento.target.value }))}
                aria-label="Inicio outbox"
              />
              <input
                type="datetime-local"
                className="h-9 rounded-md border border-linha px-2 text-sm"
                value={filtrosOutbox.fim}
                onChange={(evento) => setFiltrosOutbox((atual) => ({ ...atual, fim: evento.target.value }))}
                aria-label="Fim outbox"
              />
              <Botao type="submit" disabled={carregando}>
                <Search size={16} />
                Filtrar
              </Botao>
            </form>
            <div className="divide-y divide-linha">
              {dados?.falhas.length ? (
                dados.falhas.map((falha) => (
                  <div key={falha.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{falha.tipo}</strong>
                        <span className="rounded-sm bg-perigo-suave px-2 py-1 text-xs font-semibold text-perigo">
                          {falha.tentativas} tentativas
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-texto-suave">{falha.erro ?? 'Erro nao informado'}</p>
                      <p className="mt-1 break-all text-xs text-texto-suave">{resumirPayload(falha.payload)}</p>
                      <p className="mt-1 text-xs text-texto-suave">{formatarData(falha.criadoEm)}</p>
                    </div>
                    <Botao onClick={() => reprocessar(falha.id)} disabled={reprocessandoId === falha.id}>
                      <Undo2 size={16} />
                      {reprocessandoId === falha.id ? 'Enviando' : 'Reprocessar'}
                    </Botao>
                  </div>
                ))
              ) : (
                <EstadoVazio titulo="Nenhuma falha carregada." />
              )}
            </div>
            <div className="flex flex-col gap-2 border-t border-linha px-4 py-3 md:flex-row md:items-center md:justify-between">
              <span className="text-sm text-texto-suave">
                Pagina {falhasPaginadas?.pagina ?? 1} de {totalPaginasOutbox} | {falhasPaginadas?.total ?? 0} eventos
              </span>
              <div className="flex gap-2">
                <Botao
                  type="button"
                  onClick={() => void trocarPaginaOutbox((falhasPaginadas?.pagina ?? 1) - 1)}
                  disabled={!falhasPaginadas || falhasPaginadas.pagina <= 1 || carregando}
                >
                  Anterior
                </Botao>
                <Botao
                  type="button"
                  onClick={() => void trocarPaginaOutbox((falhasPaginadas?.pagina ?? 1) + 1)}
                  disabled={!falhasPaginadas || falhasPaginadas.pagina >= totalPaginasOutbox || carregando}
                >
                  Proxima
                </Botao>
              </div>
            </div>
          </Cartao>

          <Cartao>
            <CartaoCabecalho>
              <h2 className="text-base font-semibold">Sync mobile</h2>
              <Smartphone size={19} className="text-primaria" />
            </CartaoCabecalho>
            <div className="divide-y divide-linha">
              {dados?.sincronizacoes.length ? (
                dados.sincronizacoes.map((item) => (
                  <div key={item.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-sm">{item.tipo}</strong>
                      <span
                        className={
                          item.status === 'sincronizado'
                            ? 'rounded-sm bg-sucesso-suave px-2 py-1 text-xs font-semibold text-sucesso'
                            : 'rounded-sm bg-perigo-suave px-2 py-1 text-xs font-semibold text-perigo'
                        }
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-1 break-all text-xs text-texto-suave">{item.idLocal}</p>
                    <p className="mt-1 text-xs text-texto-suave">{item.recursoId ?? item.erro ?? '-'}</p>
                    <p className="mt-1 text-xs text-texto-suave">{formatarData(item.criadoEm)}</p>
                  </div>
                ))
              ) : (
                <EstadoVazio titulo="Nenhuma sincronizacao carregada." />
              )}
            </div>
          </Cartao>
        </section>
      </div>
  );
}
