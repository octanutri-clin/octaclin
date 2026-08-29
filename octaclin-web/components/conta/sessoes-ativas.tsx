'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, MonitorSmartphone } from 'lucide-react';
import {
  encerrarOutrasSessoes,
  encerrarSessao,
  listarSessoes,
  type SessaoAtivaPublica
} from '@/lib/auth-api';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoSubtitulo, CartaoTitulo } from '@/components/ui/cartao';
import { Etiqueta } from '@/components/ui/etiqueta';
import { AlertaOperacional, AlertaSucesso, EsqueletoPagina, EstadoFalha } from '@/components/ui/feedback';

const ROTULO_ESTADO: Record<SessaoAtivaPublica['estado'], string> = {
  ativa: 'Ativa',
  revogada: 'Encerrada',
  expirada: 'Expirada'
};

function formatar(instante: string) {
  return new Date(instante).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function SessoesAtivas() {
  const router = useRouter();
  const [sessoes, setSessoes] = useState<SessaoAtivaPublica[]>();
  const [erro, setErro] = useState<string>();
  const [aviso, setAviso] = useState<string>();
  const [processando, setProcessando] = useState(false);

  const carregar = useCallback(async () => {
    setErro(undefined);
    try {
      setSessoes(await listarSessoes());
    } catch (falha) {
      setSessoes(undefined);
      setErro(falha instanceof Error ? falha.message : 'Não foi possível carregar as sessões.');
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function executar(acao: () => Promise<string>) {
    setProcessando(true);
    setErro(undefined);
    setAviso(undefined);
    try {
      setAviso(await acao());
      await carregar();
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível concluir a ação.');
    } finally {
      setProcessando(false);
    }
  }

  const ativas = (sessoes ?? []).filter((sessao) => sessao.estado === 'ativa');
  const outrasAtivas = ativas.filter((sessao) => !sessao.atual).length;

  if (erro && !sessoes) {
    return <EstadoFalha titulo="Sessões indisponíveis" descricao={erro} aoTentarNovamente={carregar} />;
  }

  if (!sessoes) return <EsqueletoPagina rotulo="Carregando sessões" />;

  return (
    <Cartao>
      <CartaoCabecalho>
        <div className="min-w-0">
          <CartaoTitulo icone={<MonitorSmartphone size={16} />}>Sessões da sua conta</CartaoTitulo>
          <CartaoSubtitulo>
            Cada acesso abre uma sessão própria. Encerrar uma sessão invalida os tokens dela em todos os
            servidores.
          </CartaoSubtitulo>
        </div>
        <Botao
          type="button"
          variante="secundario"
          disabled={processando || outrasAtivas === 0}
          onClick={() =>
            executar(async () => {
              const { encerradas } = await encerrarOutrasSessoes();
              return `${encerradas} sessão(ões) encerrada(s).`;
            })
          }
        >
          Encerrar outras sessões
        </Botao>
      </CartaoCabecalho>
      <CartaoConteudo className="space-y-3">
        {aviso ? <AlertaSucesso mensagem={aviso} /> : null}
        {erro ? <AlertaOperacional mensagem={erro} /> : null}

        <ul className="divide-y divide-linha">
          {sessoes.map((sessao) => (
            <li key={sessao.referencia} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-tinta">
                  {sessao.atual ? 'Esta sessão' : 'Outro acesso'}
                  <Etiqueta variante={sessao.estado === 'ativa' ? 'sucesso' : 'neutra'}>
                    {ROTULO_ESTADO[sessao.estado]}
                  </Etiqueta>
                </p>
                <p className="text-xs text-texto-suave">
                  Início {formatar(sessao.criadaEm)} · Última atividade {formatar(sessao.ultimaAtividadeEm)} ·
                  Expira {formatar(sessao.expiraEm)}
                </p>
              </div>
              {sessao.estado === 'ativa' ? (
                <Botao
                  type="button"
                  variante={sessao.atual ? 'secundario' : 'perigo'}
                  tamanho="sm"
                  disabled={processando}
                  onClick={() =>
                    executar(async () => {
                      await encerrarSessao(sessao.referencia);
                      if (sessao.atual) router.replace('/login');
                      return 'Sessão encerrada.';
                    })
                  }
                >
                  <LogOut size={14} />
                  {sessao.atual ? 'Sair desta sessão' : 'Encerrar'}
                </Botao>
              ) : null}
            </li>
          ))}
        </ul>
      </CartaoConteudo>
    </Cartao>
  );
}
