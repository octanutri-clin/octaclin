'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useCallback, useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { useAtualizacaoPeriodica } from '@/lib/hooks';
import {
  destinoNotificacao,
  gerarResumoNotificacoes,
  listarNotificacoes,
  marcarResumoLido,
  marcarNotificacoesLidas,
  rotuloNotificacao,
  type NotificacaoApi,
  type ResumoNotificacaoApi
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

const destinosResumo: Record<string, { rotulo: string; destino: string }> = {
  formulario_respondido: { rotulo: 'Formulários respondidos', destino: '/questionarios' },
  tarefa_concluida: { rotulo: 'Tarefas concluídas', destino: '/pacientes' },
  automacao_executada: { rotulo: 'Automações executadas', destino: '/automacoes' }
};

function LinhaResumo({ resumo, aoLer }: { resumo: ResumoNotificacaoApi; aoLer: (id: string) => void }) {
  const periodo = `${new Date(resumo.periodoInicioEm).toLocaleDateString('pt-BR')} – ${new Date(resumo.periodoFimEm).toLocaleDateString('pt-BR')}`;
  const email = resumo.estadoEmail === 'incerto' ? 'E-mail: envio não confirmado'
    : resumo.estadoEmail === 'enviado' ? 'E-mail: envio aceito'
      : resumo.estadoEmail === 'falhou' ? 'E-mail: não enviado'
        : resumo.estadoEmail === 'pendente' || resumo.estadoEmail === 'reservado' ? 'E-mail: aguardando envio' : undefined;
  return (
    <section className="mx-1 my-1 rounded-md border border-borda p-3 text-sm" aria-label={`Resumo de notificações, ${periodo}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">Resumo · {periodo}</p>
          {!resumo.lidoEm ? <span className="text-xs text-primaria">Não lido</span> : null}
        </div>
        {!resumo.lidoEm ? <button type="button" role="menuitem" className="text-xs text-primaria underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria" onClick={() => aoLer(resumo.id)}>Marcar lido</button> : null}
      </div>
      <ul className="mt-2 space-y-1">
        {Object.entries(resumo.contagens).filter(([, quantidade]) => Number(quantidade) > 0).map(([tipo, quantidade]) => {
          const item = destinosResumo[tipo];
          return item ? <li key={tipo}><Link role="menuitem" className="text-primaria underline" href={item.destino as Route}>{quantidade} {item.rotulo.toLocaleLowerCase()}</Link></li> : null;
        })}
      </ul>
      {email ? <p className="mt-2 text-xs text-tinta-suave">{email}</p> : null}
    </section>
  );
}

export function SinoNotificacoes() {
  const [naoLidas, setNaoLidas] = useState(0);
  const [itens, setItens] = useState<NotificacaoApi[]>([]);
  const [resumos, setResumos] = useState<ResumoNotificacaoApi[]>([]);

  const recarregar = useCallback(() => {
    // Uma falha de poll nao vira erro na tela: o sino mantem o ultimo estado
    // conhecido e tenta de novo no proximo tick. E o "degrada sem erro visivel"
    // do criterio de aceite — inclusive durante o cold start do backend.
    void listarNotificacoes()
      .then((central) => {
        setNaoLidas(central.naoLidas);
        setItens(central.itens);
        setResumos(central.resumos ?? []);
      })
      .catch(() => undefined);
  }, []);

  useAtualizacaoPeriodica(recarregar, INTERVALO_MS);

  useEffect(() => {
    let ativo = true;
    const gerarEAtualizar = async () => {
      try {
        const gerado = await gerarResumoNotificacoes();
        if (ativo && gerado) recarregar();
      } catch {
        // A próxima abertura/rodada tenta novamente; a falha não afeta a caixa atual.
      }
    };
    void gerarEAtualizar();
    const temporizador = window.setInterval(() => void gerarEAtualizar(), 60_000);
    return () => { ativo = false; window.clearInterval(temporizador); };
  }, [recarregar]);

  const marcarTodas = useCallback(() => {
    void marcarNotificacoesLidas()
      .then(() => {
        setNaoLidas(0);
        setItens((atuais) => atuais.map((item) => ({ ...item, lidoEm: item.lidoEm ?? new Date().toISOString() })));
        setResumos((atuais) => atuais.map((resumo) => ({ ...resumo, lidoEm: resumo.lidoEm ?? new Date().toISOString() })));
      })
      .catch(() => undefined);
  }, []);

  const rotulo = naoLidas ? `Notificações, ${naoLidas} não lidas` : 'Notificações';

  const marcarResumo = useCallback((id: string) => {
    void marcarResumoLido(id).then(() => {
      setResumos((atuais) => atuais.map((resumo) => resumo.id === id ? { ...resumo, lidoEm: new Date().toISOString() } : resumo));
      setNaoLidas((atual) => Math.max(0, atual - 1));
    }).catch(() => undefined);
  }, []);

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
      {resumos.map((resumo) => <LinhaResumo key={resumo.id} resumo={resumo} aoLer={marcarResumo} />)}
      {itens.length ? (
        <div className="max-h-96 overflow-y-auto">
          {itens.map((notificacao) => (
            <LinhaNotificacao key={notificacao.id} notificacao={notificacao} />
          ))}
        </div>
      ) : !resumos.length ? (
        <p className="px-3 py-4 text-sm text-tinta-suave">Nenhuma notificacao por aqui.</p>
      ) : null}
      <Link role="menuitem" href="/conta/notificacoes" className="block rounded px-3 py-2 text-sm text-primaria hover:bg-superficie-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria">Preferências de notificações</Link>
    </Menu>
  );
}
