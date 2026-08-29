'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, LogOut, MonitorSmartphone, Trash2 } from 'lucide-react';
import {
  encerrarSessao,
  encerrarTodasSessoes,
  limparHistoricoSessoes,
  listarSessoes,
  sair,
  type SessaoAtivaPublica,
  type SessoesPaginadasPublicas
} from '@/lib/auth-api';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoSubtitulo, CartaoTitulo } from '@/components/ui/cartao';
import { Etiqueta } from '@/components/ui/etiqueta';
import { AlertaOperacional, AlertaSucesso, EsqueletoPagina, EstadoFalha } from '@/components/ui/feedback';
import { ModalConfirmacao } from '@/components/ui/modal';

const ROTULO_ESTADO: Record<SessaoAtivaPublica['estado'], string> = {
  ativa: 'Ativa',
  revogada: 'Encerrada',
  expirada: 'Expirada'
};

function formatar(instante: string) {
  return new Date(instante).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function mensagemRemocao(quantidade: number) {
  return quantidade === 1 ? '1 acesso removido do histórico.' : `${quantidade} acessos removidos do histórico.`;
}

export function SessoesAtivas() {
  const router = useRouter();
  const [dados, setDados] = useState<SessoesPaginadasPublicas>();
  const [pagina, setPagina] = useState(1);
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const [processando, setProcessando] = useState(false);
  const [confirmacao, setConfirmacao] = useState<'todas' | 'historico' | null>(null);

  const carregar = useCallback(async (paginaDesejada = pagina) => {
    setErro(undefined);
    try {
      const resultado = await listarSessoes(paginaDesejada);
      setDados(resultado);
      const paginaValida = Math.min(resultado.pagina, resultado.totalPaginas);
      if (paginaValida !== pagina) setPagina(paginaValida);
    } catch (falha) {
      setDados(undefined);
      setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar as sessões.');
    }
  }, [pagina]);

  useEffect(() => {
    let ativo = true;
    listarSessoes(pagina)
      .then((resultado) => {
        if (!ativo) return;
        setDados(resultado);
        setErro(undefined);
        const paginaValida = Math.min(resultado.pagina, resultado.totalPaginas);
        if (paginaValida !== pagina) setPagina(paginaValida);
      })
      .catch((falha: unknown) => {
        if (!ativo) return;
        setDados(undefined);
        setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar as sessões.');
      });
    return () => {
      ativo = false;
    };
  }, [pagina]);

  async function executar(acao: () => Promise<string>, paginaDepois = pagina) {
    setProcessando(true);
    setErro(undefined);
    setAviso(undefined);
    try {
      setAviso(await acao());
      await carregar(paginaDepois);
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível concluir a ação.');
    } finally {
      setProcessando(false);
    }
  }

  async function encerrarSessaoAtual() {
    setProcessando(true);
    setErro(undefined);
    try {
      await sair();
      router.replace('/login');
      router.refresh();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível encerrar a sessão.');
      setProcessando(false);
    }
  }

  async function confirmarEncerramentoTotal() {
    setProcessando(true);
    setErro(undefined);
    setConfirmacao(null);
    try {
      await encerrarTodasSessoes();
      router.replace('/login');
      router.refresh();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível encerrar todas as sessões.');
      setProcessando(false);
    }
  }

  if (erro && !dados) {
    return <EstadoFalha titulo="Sessões indisponíveis" descricao={erro} aoTentarNovamente={() => carregar()} />;
  }

  if (!dados) return <EsqueletoPagina rotulo="Carregando sessões" />;

  return (
    <>
      <Cartao>
        <CartaoCabecalho>
          <div className="min-w-0">
            <CartaoTitulo icone={<MonitorSmartphone size={16} />}>Sessões da sua conta</CartaoTitulo>
            <CartaoSubtitulo>
              Consulte os acessos recentes e encerre imediatamente qualquer sessão que você não reconheça.
            </CartaoSubtitulo>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Botao
              type="button"
              variante="secundario"
              disabled={processando || dados.total === 0}
              onClick={() => setConfirmacao('historico')}
            >
              <Trash2 size={16} aria-hidden="true" />
              Limpar histórico de acessos
            </Botao>
            <Botao
              type="button"
              variante="perigo"
              disabled={processando}
              onClick={() => setConfirmacao('todas')}
            >
              <LogOut size={16} aria-hidden="true" />
              Encerrar todas as sessões ativas
            </Botao>
          </div>
        </CartaoCabecalho>
        <CartaoConteudo className="space-y-4">
          {aviso ? <AlertaSucesso mensagem={aviso} /> : null}
          {erro ? <AlertaOperacional mensagem={erro} /> : null}

          <div className="overflow-x-auto" tabIndex={0} aria-label="Histórico de acessos da conta">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <caption className="sr-only">Histórico de acessos da conta</caption>
              <thead>
                <tr className="border-b border-linha text-xs text-texto-suave">
                  <th scope="col" className="px-3 py-2 font-medium">Acesso</th>
                  <th scope="col" className="px-3 py-2 font-medium">Situação</th>
                  <th scope="col" className="px-3 py-2 font-medium">Início</th>
                  <th scope="col" className="px-3 py-2 font-medium">Última atividade</th>
                  <th scope="col" className="px-3 py-2 font-medium">Expira em</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-linha">
                {dados.itens.map((sessao) => (
                  <tr key={sessao.referencia}>
                    <th scope="row" className="whitespace-nowrap px-3 py-3 font-medium text-tinta">
                      {sessao.atual ? 'Esta sessão' : 'Outro acesso'}
                    </th>
                    <td className="px-3 py-3">
                      <Etiqueta variante={sessao.estado === 'ativa' ? 'sucesso' : 'neutra'}>
                        {ROTULO_ESTADO[sessao.estado]}
                      </Etiqueta>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-texto-suave">
                      {formatar(sessao.criadaEm)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-texto-suave">
                      {formatar(sessao.ultimaAtividadeEm)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-texto-suave">
                      {formatar(sessao.expiraEm)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {sessao.estado === 'ativa' ? (
                        <Botao
                          type="button"
                          variante={sessao.atual ? 'secundario' : 'perigo'}
                          tamanho="sm"
                          disabled={processando}
                          onClick={() => {
                            if (sessao.atual) {
                              void encerrarSessaoAtual();
                              return;
                            }
                            void executar(async () => {
                              await encerrarSessao(sessao.referencia);
                              return 'Sessão encerrada.';
                            });
                          }}
                        >
                          <LogOut size={14} aria-hidden="true" />
                          {sessao.atual ? 'Sair desta sessão' : 'Encerrar'}
                        </Botao>
                      ) : (
                        <span className="text-xs text-texto-suave">Sem ação disponível</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-3">
            <p className="text-xs text-texto-suave">
              Página {dados.pagina} de {dados.totalPaginas} · {dados.total} acessos
            </p>
            <div className="flex gap-2">
              <Botao
                type="button"
                tamanho="sm"
                variante="secundario"
                disabled={processando || pagina <= 1}
                aria-label="Página anterior"
                onClick={() => setPagina((atual) => Math.max(1, atual - 1))}
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Anterior
              </Botao>
              <Botao
                type="button"
                tamanho="sm"
                variante="secundario"
                disabled={processando || pagina >= dados.totalPaginas}
                aria-label="Próxima página"
                onClick={() => setPagina((atual) => Math.min(dados.totalPaginas, atual + 1))}
              >
                Próxima
                <ChevronRight size={16} aria-hidden="true" />
              </Botao>
            </div>
          </div>
        </CartaoConteudo>
      </Cartao>

      <ModalConfirmacao
        aberto={confirmacao === 'todas'}
        titulo="Encerrar todas as sessões ativas"
        mensagem="Todos os acessos, incluindo esta sessão, serão encerrados. Você precisará entrar novamente."
        rotuloConfirmar="Encerrar todas"
        confirmando={processando}
        aoCancelar={() => setConfirmacao(null)}
        aoConfirmar={() => void confirmarEncerramentoTotal()}
      />
      <ModalConfirmacao
        aberto={confirmacao === 'historico'}
        titulo="Limpar histórico de acessos"
        mensagem="Acessos encerrados ou expirados serão removidos da lista. Sessões ativas e a trilha de segurança serão preservadas."
        rotuloConfirmar="Limpar histórico"
        confirmando={processando}
        aoCancelar={() => setConfirmacao(null)}
        aoConfirmar={() => {
          setConfirmacao(null);
          setPagina(1);
          void executar(async () => {
            const { removidos } = await limparHistoricoSessoes();
            return mensagemRemocao(removidos);
          }, 1);
        }}
      />
    </>
  );
}
