'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useCallback, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAtualizacaoPeriodica } from '@/lib/hooks';
import {
  destinoNotificacao,
  listarNotificacoes,
  marcarNotificacoesLidas,
  rotuloNotificacao,
  type NotificacaoApi
} from '@/lib/notificacoes-api';
import { Menu } from '@/components/ui/menu';
import { classesBotao } from '@/components/ui/botao';
import { Dica } from '@/components/ui/dica';

/**
 * Intervalo do criterio de aceite da Fase 210: mensagem recebida aparece em ate
 * 5s sem recarga. Sem SSE por decisao registrada em `fase-210-*.md`.
 */
const INTERVALO_MS = 5000;

function formatarQuando(criadoEm: string) {
  const minutos = Math.floor((Date.now() - new Date(criadoEm).getTime()) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  return `há ${Math.floor(horas / 24)} d`;
}

function LinhaNotificacao({ notificacao }: { notificacao: NotificacaoApi }) {
  return (
    <Link
      href={destinoNotificacao(notificacao.tipo) as Route}
      role="menuitem"
      className="flex flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm text-tinta transition-colors hover:bg-superficie-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
    >
      <span className="flex items-center gap-2">
        {notificacao.lidoEm ? null : (
          <span className="size-1.5 shrink-0 rounded-full bg-primaria" aria-label="Não lida" />
        )}
        <span className="font-medium">{rotuloNotificacao(notificacao.tipo)}</span>
      </span>
      <span className="text-xs text-tinta-suave">
        {notificacao.pacienteNome ? `${notificacao.pacienteNome} - ` : ''}
        {formatarQuando(notificacao.criadoEm)}
      </span>
    </Link>
  );
}

export function SinoNotificacoes() {
  const [naoLidas, setNaoLidas] = useState(0);
  const [itens, setItens] = useState<NotificacaoApi[]>([]);

  const recarregar = useCallback(() => {
    // Uma falha de poll nao vira erro na tela: o sino mantem o ultimo estado
    // conhecido e tenta de novo no proximo tick. E o "degrada sem erro visivel"
    // do criterio de aceite — inclusive durante o cold start do backend.
    void listarNotificacoes()
      .then((central) => {
        setNaoLidas(central.naoLidas);
        setItens(central.itens);
      })
      .catch(() => undefined);
  }, []);

  useAtualizacaoPeriodica(recarregar, INTERVALO_MS);

  const marcarTodas = useCallback(() => {
    void marcarNotificacoesLidas()
      .then(() => {
        setNaoLidas(0);
        setItens((atuais) => atuais.map((item) => ({ ...item, lidoEm: item.lidoEm ?? new Date().toISOString() })));
      })
      .catch(() => undefined);
  }, []);

  const rotulo = naoLidas ? `Notificações, ${naoLidas} não lidas` : 'Notificações';

  return (
    <Menu
      className="w-80 max-w-[calc(100vw-2rem)] p-2"
      gatilho={
        <Dica texto={rotulo}>
          <button type="button" aria-label={rotulo} className={classesBotao({ className: 'relative' })}>
            <Bell size={16} />
            <span className="hidden xl:inline">Notificações</span>
            {naoLidas ? (
              <span
                aria-hidden="true"
                className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-perigo px-1 text-[11px] font-semibold leading-5 text-white"
              >
                {naoLidas > 9 ? '9+' : naoLidas}
              </span>
            ) : null}
          </button>
        </Dica>
      }
    >
      <div className="flex items-center justify-between px-2 pb-1 pt-0.5">
        <span className="text-xs font-semibold uppercase tracking-wide text-tinta-suave">Notificações</span>
        {naoLidas ? (
          <button
            type="button"
            role="menuitem"
            onClick={marcarTodas}
            className="rounded text-xs text-primaria hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
          >
            Marcar todas como lidas
          </button>
        ) : null}
      </div>
      {itens.length ? (
        <div className="max-h-96 overflow-y-auto">
          {itens.map((notificacao) => (
            <LinhaNotificacao key={notificacao.id} notificacao={notificacao} />
          ))}
        </div>
      ) : (
        <p className="px-3 py-4 text-sm text-tinta-suave">Nenhuma notificacao por aqui.</p>
      )}
    </Menu>
  );
}
