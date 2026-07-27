'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock, Mail, MessageCircle, Send } from 'lucide-react';
import {
  AgendaPublicaApi,
  carregarAgendaPublica,
  criarSolicitacaoAgendaPublica
} from '@/lib/agendamento-publico-api';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Rotulo } from '@/components/ui/campo';
import { Cartao, CartaoCabecalho, CartaoConteudo } from '@/components/ui/cartao';
import { AlertaOperacional, EstadoVazio } from '@/components/ui/feedback';

interface Props {
  token: string;
}

interface FormularioSolicitacao {
  nome: string;
  email: string;
  whatsapp: string;
  observacao: string;
}

const formularioInicial: FormularioSolicitacao = {
  nome: '',
  email: '',
  whatsapp: '',
  observacao: ''
};

function formatarDataHora(valor: string, timezone: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Data invalida';

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(data);
}

export function FormularioAgendamentoPublico({ token }: Props) {
  const [agenda, setAgenda] = useState<AgendaPublicaApi | null>(null);
  const [horarioSelecionado, setHorarioSelecionado] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<FormularioSolicitacao>(formularioInicial);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    setCarregando(true);
    carregarAgendaPublica(token)
      .then((resposta) => {
        setAgenda(resposta);
        setErro(null);
      })
      .catch((erroAtual) => {
        setErro(erroAtual instanceof Error ? erroAtual.message : 'Link de agendamento indisponivel.');
        setAgenda(null);
      })
      .finally(() => setCarregando(false));
  }, [token]);

  const totalHorarios = useMemo(
    () => agenda?.dias.reduce((total, dia) => total + dia.horarios.length, 0) ?? 0,
    [agenda]
  );

  async function enviarSolicitacao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!agenda) return;

    if (!horarioSelecionado) {
      setErro('Selecione um horario antes de enviar a solicitacao.');
      return;
    }

    setErro(null);
    setSalvando(true);
    try {
      await criarSolicitacaoAgendaPublica(token, {
        nome: formulario.nome.trim(),
        email: formulario.email.trim(),
        whatsapp: formulario.whatsapp.trim() || undefined,
        observacao: formulario.observacao.trim() || undefined,
        inicioEm: horarioSelecionado
      });
      setSucesso(true);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Nao foi possivel enviar a solicitacao.');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-fundo px-4 text-sm text-texto-suave">
        Carregando horarios disponiveis...
      </main>
    );
  }

  if (!agenda) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-fundo px-4">
        <section className="w-full max-w-xl">
          <AlertaOperacional mensagem={erro ?? 'Link de agendamento indisponivel.'} />
        </section>
      </main>
    );
  }

  if (sucesso) {
    return (
      <main className="min-h-screen bg-fundo px-4 py-8">
        <section className="mx-auto grid w-full max-w-xl gap-4">
          <Cartao>
            <CartaoConteudo className="grid gap-3 py-8 text-center">
              <CheckCircle2 size={32} className="mx-auto text-sucesso-forte" />
              <h1 className="text-2xl font-semibold text-tinta">Solicitacao enviada para analise.</h1>
              <p className="text-sm text-texto-suave">
                {horarioSelecionado ? formatarDataHora(horarioSelecionado, agenda.timezone) : 'Horario selecionado'} com{' '}
                {agenda.profissional.nomeExibicao}.
              </p>
            </CartaoConteudo>
          </Cartao>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-fundo px-4 py-6 text-tinta">
      <section className="mx-auto grid w-full max-w-6xl gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,420px)]">
        <div className="grid gap-4">
          <section className="grid gap-3 rounded-lg border border-linha bg-white px-5 py-6">
            <p className="text-xs font-semibold uppercase text-texto-suave">OctaClin</p>
            <div className="grid gap-2">
              <h1 className="text-2xl font-semibold">Agendar com {agenda.profissional.nomeExibicao}</h1>
              {agenda.profissional.especialidade ? (
                <p className="text-sm text-texto-suave">{agenda.profissional.especialidade}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-texto-suave">
              <span className="inline-flex min-h-9 items-center gap-2 rounded-md border border-linha bg-superficie px-3">
                <CalendarDays size={16} />
                {totalHorarios} horarios na janela atual
              </span>
              <span className="inline-flex min-h-9 items-center gap-2 rounded-md border border-linha bg-superficie px-3">
                <Clock size={16} />
                {agenda.duracaoMinutos} minutos por atendimento
              </span>
            </div>
          </section>

          <Cartao className="min-w-0">
            <CartaoCabecalho className="items-start">
              <div>
                <h2 className="text-base font-semibold">Horarios disponiveis</h2>
                <p className="mt-1 text-sm text-texto-suave">Escolha um unico horario para enviar a solicitacao.</p>
              </div>
              <CalendarDays size={20} className="text-primaria" />
            </CartaoCabecalho>
            <CartaoConteudo className="grid gap-4">
              {agenda.dias.length ? (
                agenda.dias.map((dia) => (
                  <section key={dia.data} className="grid gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-tinta">{dia.rotulo}</h3>
                      <span className="text-xs text-texto-suave">{dia.horarios.length} opcoes</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {dia.horarios.map((horario) => (
                        <Botao
                          key={horario.inicioEm}
                          type="button"
                          variante={horarioSelecionado === horario.inicioEm ? 'primario' : 'secundario'}
                          className="h-10 w-full"
                          onClick={() => setHorarioSelecionado(horario.inicioEm)}
                        >
                          {horario.rotulo}
                        </Botao>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <EstadoVazio
                  titulo="Nenhum horario livre"
                  descricao="Nao ha horarios disponiveis na janela publica atual. Tente novamente mais tarde."
                />
              )}
            </CartaoConteudo>
          </Cartao>
        </div>

        <Cartao className="min-w-0">
          <CartaoCabecalho className="items-start">
            <div>
              <h2 className="text-base font-semibold">Enviar solicitacao</h2>
              <p className="mt-1 text-sm text-texto-suave">Preencha apenas os dados necessarios para a analise do horario.</p>
            </div>
            <Send size={20} className="text-primaria" />
          </CartaoCabecalho>
          <CartaoConteudo>
            <form onSubmit={enviarSolicitacao} className="grid gap-4">
              <div className="grid gap-2 rounded-lg border border-linha bg-superficie px-4 py-3">
                <span className="text-xs font-semibold uppercase text-texto-suave">Horario escolhido</span>
                <span className="text-sm font-medium text-tinta">
                  {horarioSelecionado ? formatarDataHora(horarioSelecionado, agenda.timezone) : 'Selecione um horario'}
                </span>
              </div>

              <label className="grid gap-1">
                <Rotulo>Nome completo</Rotulo>
                <Campo
                  aria-label="Nome completo"
                  value={formulario.nome}
                  maxLength={180}
                  required
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, nome: evento.target.value }))}
                />
              </label>

              <label className="grid gap-1">
                <Rotulo>Email</Rotulo>
                <Campo
                  aria-label="Email"
                  type="email"
                  value={formulario.email}
                  maxLength={180}
                  required
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, email: evento.target.value }))}
                />
              </label>

              <label className="grid gap-1">
                <Rotulo>WhatsApp</Rotulo>
                <Campo
                  aria-label="WhatsApp"
                  value={formulario.whatsapp}
                  maxLength={30}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, whatsapp: evento.target.value }))}
                />
              </label>

              <label className="grid gap-1">
                <Rotulo>Observacoes</Rotulo>
                <AreaTexto
                  aria-label="Observacoes"
                  value={formulario.observacao}
                  maxLength={1000}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, observacao: evento.target.value }))}
                />
              </label>

              <div className="grid gap-2 rounded-lg border border-linha bg-superficie px-4 py-3 text-sm text-texto-suave">
                <p className="inline-flex items-center gap-2">
                  <Mail size={16} />
                  O retorno da equipe sera feito pelo contato informado.
                </p>
                <p className="inline-flex items-center gap-2">
                  <MessageCircle size={16} />
                  Nenhum dado interno de pacientes ou agenda completa fica visivel aqui.
                </p>
              </div>

              {erro ? <AlertaOperacional mensagem={erro} /> : null}

              <Botao
                type="submit"
                variante="primario"
                className="h-11"
                disabled={salvando || !agenda.dias.length}
              >
                <Send size={16} />
                {salvando ? 'Enviando solicitacao' : 'Enviar solicitacao'}
              </Botao>
            </form>
          </CartaoConteudo>
        </Cartao>
      </section>
    </main>
  );
}
