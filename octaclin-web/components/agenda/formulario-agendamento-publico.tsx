'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock, Mail, MessageCircle, Send } from 'lucide-react';
import {
  AgendaPublicaApi,
  carregarAgendaPublica,
  criarSolicitacaoAgendaPublica
} from '@/lib/agendamento-publico-api';
import { Botao } from '@/components/ui/botao';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import { AreaTexto, Campo, Rotulo } from '@/components/ui/campo';
import { Cartao, CartaoCabecalho, CartaoConteudo } from '@/components/ui/cartao';
import { AlertaOperacional, EstadoVazio } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';

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
  const [revisando, setRevisando] = useState(false);
  const alertaErroModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCarregando(true);
    carregarAgendaPublica(token)
      .then((resposta) => {
        setAgenda(resposta);
        setErro(null);
      })
      .catch((erroAtual) => {
        setErro(mensagemFalhaInterface(erroAtual, 'O link de agendamento está indisponível.'));
        setAgenda(null);
      })
      .finally(() => setCarregando(false));
  }, [token]);

  const totalHorarios = useMemo(
    () => agenda?.dias.reduce((total, dia) => total + dia.horarios.length, 0) ?? 0,
    [agenda]
  );

  function revisarSolicitacao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!agenda) return;

    if (!horarioSelecionado) {
      setErro('Selecione um horário antes de enviar a solicitação.');
      return;
    }

    setErro(null);
    setRevisando(true);
  }

  async function confirmarSolicitacao() {
    if (!agenda || !horarioSelecionado) return;

    setSalvando(true);
    try {
      await criarSolicitacaoAgendaPublica(token, {
        nome: formulario.nome.trim(),
        email: formulario.email.trim(),
        whatsapp: formulario.whatsapp.trim() || undefined,
        observacao: formulario.observacao.trim() || undefined,
        inicioEm: horarioSelecionado
      });
      setRevisando(false);
      setSucesso(true);
    } catch (erroAtual) {
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível enviar a solicitação.'));
      try {
        const agendaAtualizada = await carregarAgendaPublica(token);
        setAgenda(agendaAtualizada);
        const horarioContinuaLivre = agendaAtualizada.dias.some((dia) =>
          dia.horarios.some((horario) => horario.inicioEm === horarioSelecionado)
        );
        if (!horarioContinuaLivre) setHorarioSelecionado(null);
      } catch {
        // O erro principal continua visivel; os dados digitados permanecem intactos.
      }
      requestAnimationFrame(() => alertaErroModalRef.current?.focus());
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-fundo px-4 text-sm text-texto-suave">
        Carregando horários disponíveis...
      </main>
    );
  }

  if (!agenda) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-fundo px-4">
        <section className="w-full max-w-xl">
          <AlertaOperacional mensagem={erro ?? 'Link de agendamento indisponível.'} />
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
              <h1 className="text-2xl font-semibold text-tinta">Solicitação enviada para análise.</h1>
              <p className="text-sm text-texto-suave">
                {horarioSelecionado ? formatarDataHora(horarioSelecionado, agenda.timezone) : 'Horário selecionado'} com{' '}
                {agenda.profissional.nomeExibicao}.
              </p>
              <p className="text-sm text-texto-suave">
                A equipe confirmara a disponibilidade pelo contato informado. Este pedido ainda não confirma a consulta.
              </p>
            </CartaoConteudo>
          </Cartao>
        </section>
      </main>
    );
  }

  return (
    <>
    <main className="min-h-screen bg-fundo px-4 py-6 text-tinta">
      <section className="mx-auto grid w-full max-w-6xl gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,420px)]">
        <div className="grid gap-4">
          <section
            className="grid gap-3 rounded-lg border border-t-4 border-linha bg-white px-5 py-6"
            style={{ borderTopColor: agenda.clinica.corPrimaria }}
          >
            <p className="text-xs font-semibold uppercase text-texto-suave">{agenda.clinica.nome}</p>
            <div className="grid gap-2">
              <h1 className="text-2xl font-semibold">Agendar com {agenda.profissional.nomeExibicao}</h1>
            </div>
            <ol className="flex flex-wrap gap-2 text-sm text-texto-suave" aria-label="Etapas do agendamento">
              <li className="rounded-md bg-primaria-suave px-3 py-2 font-medium text-primaria">1. Escolha um horário</li>
              <li className="rounded-md border border-linha bg-superficie px-3 py-2">2. Informe seus dados</li>
              <li className="rounded-md border border-linha bg-superficie px-3 py-2">3. Revise e confirme</li>
            </ol>
            <div className="flex flex-wrap gap-2 text-sm text-texto-suave">
              <span className="inline-flex min-h-9 items-center gap-2 rounded-md border border-linha bg-superficie px-3">
                <CalendarDays size={16} />
                {totalHorarios} horários na janela atual
              </span>
              <span className="inline-flex min-h-9 items-center gap-2 rounded-md border border-linha bg-superficie px-3">
                <Clock size={16} />
                {agenda.duracaoMinutos} minutos por atendimento
              </span>
              <span className="inline-flex min-h-9 items-center gap-2 rounded-md border border-linha bg-superficie px-3">
                <Clock size={16} />
                Horários em {agenda.timezone.replace('_', ' ')}
              </span>
            </div>
          </section>

          <Cartao className="min-w-0">
            <CartaoCabecalho className="items-start">
              <div>
                <h2 className="text-base font-semibold">Horários disponíveis</h2>
                <p className="mt-1 text-sm text-texto-suave">Escolha um único horário para enviar a solicitação.</p>
              </div>
              <CalendarDays size={20} className="text-primaria" />
            </CartaoCabecalho>
            <CartaoConteudo className="grid gap-4">
              {agenda.dias.length ? (
                agenda.dias.map((dia) => (
                  <section key={dia.data} className="grid gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold text-tinta">{dia.rotulo}</h3>
                      <span className="text-xs text-texto-suave">{dia.horarios.length} opções</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {dia.horarios.map((horario) => (
                        <Botao
                          key={horario.inicioEm}
                          type="button"
                          variante={horarioSelecionado === horario.inicioEm ? 'primario' : 'secundario'}
                          className="h-10 w-full"
                          aria-pressed={horarioSelecionado === horario.inicioEm}
                          aria-label={`Selecionar ${horario.rotulo} em ${dia.rotulo}`}
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
                  titulo="Nenhum horário livre"
                  descricao="Não há horários disponíveis na janela pública atual. Tente novamente mais tarde."
                />
              )}
            </CartaoConteudo>
          </Cartao>
        </div>

        <Cartao className="min-w-0">
          <CartaoCabecalho className="items-start">
            <div>
              <h2 className="text-base font-semibold">Enviar solicitação</h2>
              <p className="mt-1 text-sm text-texto-suave">Preencha apenas os dados necessários para a análise do horário.</p>
            </div>
            <Send size={20} className="text-primaria" />
          </CartaoCabecalho>
          <CartaoConteudo>
            <form onSubmit={revisarSolicitacao} className="grid gap-4">
              <div className="grid gap-2 rounded-lg border border-linha bg-superficie px-4 py-3" aria-live="polite">
                <span className="text-xs font-semibold uppercase text-texto-suave">Horário escolhido</span>
                <span className="text-sm font-medium text-tinta">
                  {horarioSelecionado ? formatarDataHora(horarioSelecionado, agenda.timezone) : 'Selecione um horário'}
                </span>
                <span className="text-xs text-texto-suave">Fuso horário: {agenda.timezone.replace('_', ' ')}</span>
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
                <Rotulo>Observações</Rotulo>
                <AreaTexto
                  aria-label="Observações"
                  value={formulario.observacao}
                  maxLength={1000}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, observacao: evento.target.value }))}
                />
              </label>

              <div className="grid gap-2 rounded-lg border border-linha bg-superficie px-4 py-3 text-sm text-texto-suave">
                <p className="inline-flex items-center gap-2">
                  <Mail size={16} />
                  O retorno da equipe será feito pelo contato informado.
                </p>
                <p className="inline-flex items-center gap-2">
                  <MessageCircle size={16} />
                  O horário só será reservado após a confirmação da equipe.
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
                Revisar solicitação
              </Botao>
            </form>
          </CartaoConteudo>
        </Cartao>
      </section>
    </main>
    <Modal
      aberto={revisando}
      aoFechar={() => setRevisando(false)}
      titulo="Revise sua solicitação"
      descricao="Confira os dados antes de enviar. O horário ainda dependerá da confirmação da equipe."
    >
      <dl className="grid gap-3 text-sm">
        <div><dt className="text-xs font-semibold text-texto-suave">Clínica</dt><dd>{agenda.clinica.nome}</dd></div>
        <div><dt className="text-xs font-semibold text-texto-suave">Profissional</dt><dd>{agenda.profissional.nomeExibicao}</dd></div>
        <div><dt className="text-xs font-semibold text-texto-suave">Horário</dt><dd>{horarioSelecionado ? formatarDataHora(horarioSelecionado, agenda.timezone) : ''}</dd></div>
        <div><dt className="text-xs font-semibold text-texto-suave">Nome</dt><dd>{formulario.nome.trim()}</dd></div>
        <div><dt className="text-xs font-semibold text-texto-suave">Email</dt><dd className="break-all">{formulario.email.trim()}</dd></div>
      </dl>
      {erro ? (
        <div ref={alertaErroModalRef} tabIndex={-1} className="mt-4 focus:outline-none">
          <AlertaOperacional mensagem={`${erro} Revise os horários disponíveis antes de tentar novamente.`} />
        </div>
      ) : null}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <Botao type="button" variante="secundario" onClick={() => setRevisando(false)} disabled={salvando}>Voltar e editar</Botao>
        <Botao type="button" variante="primario" onClick={() => void confirmarSolicitacao()} disabled={salvando}>
          {salvando ? 'Enviando solicitação' : 'Confirmar solicitação'}
        </Botao>
      </div>
    </Modal>
    </>
  );
}
