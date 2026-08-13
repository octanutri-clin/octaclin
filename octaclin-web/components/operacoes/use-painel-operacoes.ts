'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequisicaoCancelavel } from '@/lib/hooks';
import { SessaoPublica, obterSessao, sair } from '@/lib/auth-api';
import {
  DadosOperacionais,
  DetalheSolicitacaoLgpdOperacional,
  ErroApiOperacoes,
  FiltrosAuditoriaOperacional,
  FiltrosFalhasComunicacao,
  FiltrosOutboxOperacional,
  FiltrosSolicitacoesLgpd,
  RespostaSolicitacaoLgpdOperacional,
  StatusSolicitacaoLgpd,
  SolicitacaoAssinaturaOperacional,
  aplicarPlanoAssinatura,
  atualizarSolicitacaoLgpd,
  carregarAuditoriaOperacionalPaginada,
  carregarDadosOperacionais,
  carregarFalhasComunicacao,
  carregarFalhasOutboxPaginadas,
  carregarRetencaoDadosOperacional,
  carregarSolicitacoesAssinatura,
  carregarSolicitacoesLgpd,
  obterDetalheSolicitacaoLgpd,
  prepararRespostaSolicitacaoLgpd,
  programarRetencaoDadosOperacional,
  reprocessarFalhaComunicacao,
  reprocessarOutbox,
  urlExportacaoAuditoria,
  urlExportacaoFalhasOutbox,
  urlExportacaoSolicitacaoLgpd
} from '@/lib/operacoes-api';

export type AreaOperacoes = 'onboarding' | 'saude' | 'incidentes' | 'comunicacoes' | 'lgpd' | 'auditoria' | 'filas';

function chaveSolicitacaoAssinatura(solicitacao: SolicitacaoAssinaturaOperacional) {
  return `${solicitacao.tenantId}:${solicitacao.solicitadoEm}:${solicitacao.planoDesejado ?? solicitacao.planoAtualId}`;
}

export function usePainelOperacoes() {
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
      const solicitacoesLgpd = await executarAutenticado(() =>
        carregarSolicitacoesLgpd({ ...filtrosLgpd, pagina: 1 }, { signal })
      );
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

  return {
    sessao,
    areaAtiva,
    setAreaAtiva,
    dados,
    erro,
    sucesso,
    carregando,
    carregandoAuditoria,
    carregandoAssinatura,
    carregandoLgpd,
    carregandoDetalheLgpd,
    reprocessandoId,
    reprocessandoComunicacaoId,
    aplicandoAssinaturaId,
    atualizandoLgpdProtocolo,
    preparandoRespostaProtocolo,
    programandoRetencao,
    detalheLgpd,
    respostaLgpd,
    filtrosAuditoria,
    setFiltrosAuditoria,
    filtrosLgpd,
    setFiltrosLgpd,
    filtrosOutbox,
    setFiltrosOutbox,
    filtrosFalhasComunicacao,
    setFiltrosFalhasComunicacao,
    auditoriaPaginada,
    falhasPaginadas,
    falhasComunicacao,
    totalPaginasAuditoria,
    totalPaginasOutbox,
    totalPaginasFalhasComunicacao,
    solicitacoesAssinatura,
    solicitacoesLgpd,
    retencaoDados,
    alertasOperacionais,
    totalPaginasLgpd,
    carregar,
    reprocessar,
    reprocessarComunicacao,
    filtrarAuditoria,
    filtrarOutbox,
    trocarPaginaAuditoria,
    trocarPaginaOutbox,
    trocarPaginaFalhasComunicacao,
    filtrarFalhasComunicacao,
    recarregarSolicitacoesAssinatura,
    aplicarPlanoSolicitacao,
    filtrarLgpd,
    trocarPaginaLgpd,
    atualizarLgpd,
    carregarDetalheLgpd,
    exportarSolicitacaoLgpd,
    prepararRespostaLgpd,
    copiarRespostaLgpd,
    programarRetencaoLgpd,
    exportarAuditoria,
    exportarOutbox,
    encerrarSessao
  };
}

export type PainelOperacoesControlador = ReturnType<typeof usePainelOperacoes>;
