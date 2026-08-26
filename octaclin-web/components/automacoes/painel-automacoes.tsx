'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Pause, Play, Plus, RefreshCcw, Save, SlidersHorizontal } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { AreaTexto, Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import {
  ExecucaoRegraApi,
  RegraAutomacaoApi,
  alterarAtivacaoRegra,
  carregarBootstrapAutomacoes,
  criarRegraAutomacao,
  simularRecallAutomacao,
  simularRegraAutomacao
} from '@/lib/automacoes-api';
import { PacienteResumo, ProfissionalResumo, RespostaPaginada } from '@/lib/cadastros-api';

const GATILHO_INATIVIDADE = 'paciente.inativo';

interface FormularioRegra {
  profissionalId: string;
  nome: string;
  gatilhoTipo: string;
  campo: string;
  operador: 'igual' | 'maior_que' | 'maior_ou_igual' | 'menor_que' | 'inclui';
  valor: string;
  acaoTipo: string;
  diasSemConsulta: string;
  intervaloMinimoDias: string;
  limitePorExecucao: string;
}

interface FormularioAvaliacao {
  regraId: string;
  pacienteId: string;
  status: string;
  checkinsPerdidos: string;
  frustracaoScore: string;
  observacao: string;
}

const regraInicial: FormularioRegra = {
  profissionalId: '',
  nome: 'Risco alto por check-ins perdidos',
  gatilhoTipo: 'checkin.atrasado',
  campo: 'checkinsPerdidos',
  operador: 'maior_ou_igual',
  valor: '3',
  acaoTipo: 'notificar_profissional',
  diasSemConsulta: '60',
  intervaloMinimoDias: '30',
  limitePorExecucao: '25'
};

const avaliacaoInicial: FormularioAvaliacao = {
  regraId: '',
  pacienteId: '',
  status: 'risco',
  checkinsPerdidos: '3',
  frustracaoScore: '72',
  observacao: 'Avaliacao manual pelo console OctaClin.'
};

function valorCondicao(valor: string) {
  const numero = Number(valor);
  return Number.isFinite(numero) && valor.trim() !== '' ? numero : valor;
}

function nomeProfissional(profissionais: ProfissionalResumo[], id: string) {
  return profissionais.find((profissional) => profissional.id === id)?.nome ?? id;
}

function resumirJson(valor: unknown) {
  return JSON.stringify(valor);
}

function descreverGatilho(gatilho: Record<string, unknown>) {
  if (String(gatilho.tipo) === GATILHO_INATIVIDADE) {
    return `um paciente ficar ${gatilho.diasSemConsulta ?? 60} dias sem consulta concluida`;
  }
  const rotulos: Record<string, string> = {
    'checkin.atrasado': 'um check-in estiver atrasado',
    'questionario.respondido': 'um formulario for respondido',
    'paciente.risco_alto': 'um paciente entrar em risco alto'
  };
  return rotulos[String(gatilho.tipo)] ?? resumirJson(gatilho);
}

const MOTIVOS_EXCLUSAO_RECALL: Record<string, string> = {
  opt_out: 'pediu para nao receber mensagens',
  sem_contato: 'sem contato cadastrado',
  contato_ilegivel: 'contato nao pode ser lido (falha tecnica, avise o suporte)',
  status_adesao_fora_do_filtro: 'fora do status de adesao filtrado',
  consulta_recente: 'teve consulta recente',
  recall_recente: 'ja recebeu recall dentro do intervalo minimo',
  limite_por_execucao: 'ficou fora do limite desta rodada'
};

interface CandidatoRecallApi {
  pacienteId: string;
  diasSemConsulta: number | null;
}

interface ExclusaoRecallApi {
  pacienteId: string;
  motivo: string;
}

function nomePaciente(pacientes: PacienteResumo[], id: string) {
  return pacientes.find((paciente) => paciente.id === id)?.nome ?? id;
}

function ResumoRecall({
  candidatos,
  excluidos,
  pacientes
}: {
  candidatos: CandidatoRecallApi[];
  excluidos: ExclusaoRecallApi[];
  pacientes: PacienteResumo[];
}) {
  return (
    <div className="grid gap-2 text-xs">
      <div>
        <strong>Seriam contatados ({candidatos.length}):</strong>
        {candidatos.length ? (
          <ul className="mt-1 grid gap-0.5 text-texto-suave">
            {candidatos.map((candidato) => (
              <li key={candidato.pacienteId}>
                {nomePaciente(pacientes, candidato.pacienteId)}
                {candidato.diasSemConsulta === null
                  ? ' - nunca concluiu consulta'
                  : ` - ${candidato.diasSemConsulta} dias sem consulta`}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-texto-suave">Ninguem nesta rodada.</p>
        )}
      </div>
      {excluidos.length ? (
        <div>
          <strong>Fora ({excluidos.length}):</strong>
          <ul className="mt-1 grid gap-0.5 text-texto-suave">
            {excluidos.map((excluido) => (
              <li key={`${excluido.pacienteId}-${excluido.motivo}`}>
                {nomePaciente(pacientes, excluido.pacienteId)} - {MOTIVOS_EXCLUSAO_RECALL[excluido.motivo] ?? excluido.motivo}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function descreverAcao(acoes: Array<Record<string, unknown>>) {
  const rotulos: Record<string, string> = {
    notificar_profissional: 'notificar o profissional',
    enviar_template: 'enviar uma mensagem aprovada',
    criar_tarefa: 'criar uma tarefa de acompanhamento'
  };
  return acoes.map((acao) => rotulos[String(acao.tipo)] ?? resumirJson(acao)).join(', ');
}

export function PainelAutomacoes() {
  const [regras, setRegras] = useState<RegraAutomacaoApi[]>([]);
  const [profissionais, setProfissionais] = useState<RespostaPaginada<ProfissionalResumo> | null>(null);
  const [pacientes, setPacientes] = useState<RespostaPaginada<PacienteResumo> | null>(null);
  const [execucoes, setExecucoes] = useState<ExecucaoRegraApi[]>([]);
  const [formularioRegra, setFormularioRegra] = useState<FormularioRegra>(regraInicial);
  const [formularioAvaliacao, setFormularioAvaliacao] = useState<FormularioAvaliacao>(avaliacaoInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const gatilhoInatividadeSelecionado = formularioRegra.gatilhoTipo === GATILHO_INATIVIDADE;

  async function carregar() {
    setCarregando(true);
    setErro(null);
    setSucesso(null);
    try {
      const bootstrap = await carregarBootstrapAutomacoes();
      setRegras(bootstrap.regras);
      setExecucoes(bootstrap.execucoes);
      setProfissionais(bootstrap.profissionais);
      setPacientes(bootstrap.pacientes);
      setFormularioRegra((atual) => ({
        ...atual,
        profissionalId: atual.profissionalId || bootstrap.profissionais.itens[0]?.id || ''
      }));
      setFormularioAvaliacao((atual) => ({
        ...atual,
        regraId: atual.regraId || bootstrap.regras[0]?.id || '',
        pacienteId: atual.pacienteId || bootstrap.pacientes.itens[0]?.id || ''
      }));
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar automações.');
    } finally {
      setCarregando(false);
    }
  }

  async function salvarRegra(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(null);

    const ehInatividade = formularioRegra.gatilhoTipo === GATILHO_INATIVIDADE;

    try {
      const criada = await criarRegraAutomacao({
        profissionalId: formularioRegra.profissionalId,
        nome: formularioRegra.nome.trim(),
        // Inatividade nao usa condicao sobre contexto: quem seleciona os pacientes e o
        // proprio gatilho, com os limites de frequencia dentro dele.
        gatilho: ehInatividade
          ? {
              tipo: GATILHO_INATIVIDADE,
              diasSemConsulta: Number(formularioRegra.diasSemConsulta || 60),
              intervaloMinimoDias: Number(formularioRegra.intervaloMinimoDias || 30),
              limitePorExecucao: Number(formularioRegra.limitePorExecucao || 25)
            }
          : { tipo: formularioRegra.gatilhoTipo },
        condicoes: ehInatividade
          ? []
          : [
              {
                campo: formularioRegra.campo,
                operador: formularioRegra.operador,
                valor: valorCondicao(formularioRegra.valor)
              }
            ],
        acoes: [{ tipo: ehInatividade ? 'enviar_template' : formularioRegra.acaoTipo }],
        ativa: false
      });
      setRegras((atuais) => [criada, ...atuais]);
      setFormularioAvaliacao((atual) => ({ ...atual, regraId: criada.id }));
      setSucesso('Regra salva como rascunho. Simule antes de ativar.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao criar regra.');
    } finally {
      setSalvando(false);
    }
  }

  async function simular(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(null);

    try {
      const execucao = await simularRegraAutomacao({
        regraId: formularioAvaliacao.regraId,
        pacienteId: formularioAvaliacao.pacienteId || undefined,
        contexto: {
          status: formularioAvaliacao.status,
          checkinsPerdidos: Number(formularioAvaliacao.checkinsPerdidos || 0),
          frustracaoScore: Number(formularioAvaliacao.frustracaoScore || 0),
          observacao: formularioAvaliacao.observacao
        }
      });
      setExecucoes((atuais) => [execucao, ...atuais].slice(0, 8));
      setSucesso(execucao.resultado.executar ? 'Simulação concluída: a regra seria executada.' : 'Simulação concluída: as condições não foram atendidas.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao simular regra.');
    } finally {
      setSalvando(false);
    }
  }

  async function simularRecall(regra: RegraAutomacaoApi) {
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const execucao = await simularRecallAutomacao(regra.id);
      setExecucoes((atuais) => [execucao, ...atuais].slice(0, 8));
      const total = Number(execucao.resultado.totalCandidatos ?? 0);
      setSucesso(
        total
          ? `Simulação concluída: ${total} paciente(s) seriam contatados. Confira a lista antes de ativar.`
          : 'Simulação concluída: nenhum paciente seria contatado agora.'
      );
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao simular recall.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivacao(regra: RegraAutomacaoApi) {
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const atualizada = await alterarAtivacaoRegra(regra.id, !regra.ativa);
      setRegras((atuais) => atuais.map((item) => (item.id === regra.id ? atualizada : item)));
      setSucesso(atualizada.ativa ? 'Regra ativada.' : 'Regra pausada.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao alterar a regra.');
    } finally {
      setSalvando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  return (
    <section className="grid gap-4">
      <Cartao>
        <CartaoConteudo className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold">Modelos e regras</h2>
            <p className="mt-1 text-sm text-texto-suave">
              {regras.length} regras, {execucoes.length} simulacoes e execucoes no histórico
            </p>
          </div>
          <Botao onClick={carregar} disabled={carregando}>
            <RefreshCcw size={16} />
            {carregando ? 'Atualizando' : 'Atualizar'}
          </Botao>
        </CartaoConteudo>
      </Cartao>

      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      <BarraCarregamento visivel={carregando} />
      {sucesso ? (
        <div className="flex items-center gap-2 rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte">
          <CheckCircle2 size={16} />
          {sucesso}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Cartao>
        <form onSubmit={salvarRegra}>
          <CartaoCabecalho>
            <CartaoTitulo icone={<Plus size={18} className="text-primaria" />}>Nova regra</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5 md:col-span-2">
              <Rotulo htmlFor="regra-nome">Nome</Rotulo>
              <Campo
                id="regra-nome"
                value={formularioRegra.nome}
                onChange={(evento) => setFormularioRegra((atual) => ({ ...atual, nome: evento.target.value }))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="regra-profissional">Profissional</Rotulo>
              <Selecao
                id="regra-profissional"
                value={formularioRegra.profissionalId}
                onChange={(evento) => setFormularioRegra((atual) => ({ ...atual, profissionalId: evento.target.value }))}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {profissionais?.itens.map((profissional) => (
                  <option key={profissional.id} value={profissional.id}>
                    {profissional.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="regra-gatilho">Gatilho</Rotulo>
              <Selecao
                id="regra-gatilho"
                value={formularioRegra.gatilhoTipo}
                onChange={(evento) => setFormularioRegra((atual) => ({ ...atual, gatilhoTipo: evento.target.value }))}
              >
                <option value="checkin.atrasado">Check-in atrasado</option>
                <option value="questionario.respondido">Questionário respondido</option>
                <option value="paciente.risco_alto">Paciente em risco alto</option>
                <option value={GATILHO_INATIVIDADE}>Paciente sem consulta há muito tempo</option>
              </Selecao>
            </div>
            {gatilhoInatividadeSelecionado ? (
              <>
                <div className="space-y-1.5">
                  <Rotulo htmlFor="regra-dias-sem-consulta">Dias sem consulta</Rotulo>
                  <Campo
                    id="regra-dias-sem-consulta"
                    type="number"
                    min={7}
                    value={formularioRegra.diasSemConsulta}
                    onChange={(evento) => setFormularioRegra((atual) => ({ ...atual, diasSemConsulta: evento.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Rotulo htmlFor="regra-intervalo-minimo">Intervalo minimo entre recalls (dias)</Rotulo>
                  <Campo
                    id="regra-intervalo-minimo"
                    type="number"
                    min={1}
                    value={formularioRegra.intervaloMinimoDias}
                    onChange={(evento) =>
                      setFormularioRegra((atual) => ({ ...atual, intervaloMinimoDias: evento.target.value }))
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Rotulo htmlFor="regra-limite-execucao">Limite de pacientes por rodada</Rotulo>
                  <Campo
                    id="regra-limite-execucao"
                    type="number"
                    min={1}
                    max={200}
                    value={formularioRegra.limitePorExecucao}
                    onChange={(evento) =>
                      setFormularioRegra((atual) => ({ ...atual, limitePorExecucao: evento.target.value }))
                    }
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Rotulo htmlFor="regra-campo">Campo</Rotulo>
                  <Campo
                    id="regra-campo"
                    value={formularioRegra.campo}
                    onChange={(evento) => setFormularioRegra((atual) => ({ ...atual, campo: evento.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Rotulo htmlFor="regra-operador">Operador</Rotulo>
                  <Selecao
                    id="regra-operador"
                    value={formularioRegra.operador}
                    onChange={(evento) =>
                      setFormularioRegra((atual) => ({
                        ...atual,
                        operador: evento.target.value as FormularioRegra['operador']
                      }))
                    }
                  >
                    <option value="igual">Igual</option>
                    <option value="maior_que">Maior que</option>
                    <option value="maior_ou_igual">Maior ou igual</option>
                    <option value="menor_que">Menor que</option>
                    <option value="inclui">Inclui</option>
                  </Selecao>
                </div>
                <div className="space-y-1.5">
                  <Rotulo htmlFor="regra-valor">Valor</Rotulo>
                  <Campo
                    id="regra-valor"
                    value={formularioRegra.valor}
                    onChange={(evento) => setFormularioRegra((atual) => ({ ...atual, valor: evento.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Rotulo htmlFor="regra-acao">Ação</Rotulo>
                  <Selecao
                    id="regra-acao"
                    value={formularioRegra.acaoTipo}
                    onChange={(evento) => setFormularioRegra((atual) => ({ ...atual, acaoTipo: evento.target.value }))}
                  >
                    <option value="notificar_profissional">Notificar profissional</option>
                    <option value="enviar_template">Enviar template</option>
                    <option value="criar_tarefa">Criar tarefa</option>
                  </Selecao>
                </div>
              </>
            )}
          </div>
          <p className="mt-3 rounded-md border border-linha bg-fundo px-3 py-2 text-sm text-texto-suave">
            {gatilhoInatividadeSelecionado
              ? 'O recall só alcanca pacientes deste profissional que aceitam receber mensagens. Simule para ver a lista exata antes de ativar.'
              : 'Toda regra nova fica em rascunho. Simule o resultado antes de ativar.'}
          </p>
          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario" disabled={salvando || !profissionais?.itens.length}>
              <Save size={16} />
              Salvar regra
            </Botao>
          </div>
          </CartaoConteudo>
        </form>
        </Cartao>

        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo icone={<SlidersHorizontal size={16} />}>Regras cadastradas</CartaoTitulo>
          </CartaoCabecalho>
          <div tabIndex={0} aria-label="Regras cadastradas" className="max-h-[520px] divide-y divide-linha overflow-auto">
            {regras.length ? (
              regras.map((regra) => (
                <div key={regra.id} className="grid gap-2 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="truncate">{regra.nome}</strong>
                    <span className="rounded-sm bg-superficie-hover px-2 py-1 text-xs font-semibold text-texto-suave">
                      {regra.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  <p className="truncate text-xs text-texto-suave">{nomeProfissional(profissionais?.itens ?? [], regra.profissionalId)}</p>
                  <p className="text-xs text-texto-suave"><strong>Quando:</strong> {descreverGatilho(regra.gatilho)}.</p>
                  <p className="text-xs text-texto-suave"><strong>Fazer:</strong> {descreverAcao(regra.acoes)}.</p>
                  {String(regra.gatilho.tipo) === GATILHO_INATIVIDADE ? (
                    <Botao
                      type="button"
                      onClick={() => void simularRecall(regra)}
                      disabled={salvando}
                      aria-label={`Simular recall de ${regra.nome}`}
                    >
                      <Play size={16} />
                      Simular recall
                    </Botao>
                  ) : null}
                  <Botao
                    type="button"
                    onClick={() => void alternarAtivacao(regra)}
                    disabled={salvando || (!regra.ativa && !execucoes.some((item) => item.regraId === regra.id && item.resultado.simulacao === true))}
                    aria-label={`${regra.ativa ? 'Pausar' : 'Ativar'} ${regra.nome}`}
                  >
                    {regra.ativa ? <Pause size={16} /> : <Play size={16} />}
                    {regra.ativa ? 'Pausar' : 'Ativar'}
                  </Botao>
                </div>
              ))
            ) : (
              <EstadoVazio titulo="Nenhuma regra carregada." />
            )}
          </div>
        </Cartao>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <Cartao>
        <form onSubmit={simular}>
          <CartaoCabecalho>
            <CartaoTitulo icone={<Play size={18} className="text-primaria" />}>Simular antes de ativar</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Rotulo htmlFor="avaliacao-regra">Regra</Rotulo>
              <Selecao
                id="avaliacao-regra"
                value={formularioAvaliacao.regraId}
                onChange={(evento) => setFormularioAvaliacao((atual) => ({ ...atual, regraId: evento.target.value }))}
                required
              >
                <option value="" disabled>
                  Selecione
                </option>
                {regras.map((regra) => (
                    <option key={regra.id} value={regra.id}>
                      {regra.nome}
                    </option>
                  ))}
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="avaliacao-paciente">Paciente</Rotulo>
              <Selecao
                id="avaliacao-paciente"
                value={formularioAvaliacao.pacienteId}
                onChange={(evento) => setFormularioAvaliacao((atual) => ({ ...atual, pacienteId: evento.target.value }))}
              >
                <option value="">Sem paciente</option>
                {pacientes?.itens.map((paciente) => (
                  <option key={paciente.id} value={paciente.id}>
                    {paciente.nome}
                  </option>
                ))}
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="avaliacao-status">Situação</Rotulo>
              <Selecao
                id="avaliacao-status"
                value={formularioAvaliacao.status}
                onChange={(evento) => setFormularioAvaliacao((atual) => ({ ...atual, status: evento.target.value }))}
              >
                <option value="novo">Novo</option>
                <option value="em_acompanhamento">Em acompanhamento</option>
                <option value="risco">Risco</option>
              </Selecao>
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="avaliacao-checkins">Check-ins perdidos</Rotulo>
              <Campo
                id="avaliacao-checkins"
                type="number"
                min={0}
                value={formularioAvaliacao.checkinsPerdidos}
                onChange={(evento) => setFormularioAvaliacao((atual) => ({ ...atual, checkinsPerdidos: evento.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Rotulo htmlFor="avaliacao-frustracao">Frustracao</Rotulo>
              <Campo
                id="avaliacao-frustracao"
                type="number"
                min={0}
                max={100}
                value={formularioAvaliacao.frustracaoScore}
                onChange={(evento) => setFormularioAvaliacao((atual) => ({ ...atual, frustracaoScore: evento.target.value }))}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Rotulo htmlFor="avaliacao-observacao">Observação</Rotulo>
              <AreaTexto
                id="avaliacao-observacao"
                value={formularioAvaliacao.observacao}
                onChange={(evento) => setFormularioAvaliacao((atual) => ({ ...atual, observacao: evento.target.value }))}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario" disabled={salvando || !formularioAvaliacao.regraId}>
              <Play size={16} />
              Simular sem executar
            </Botao>
          </div>
          </CartaoConteudo>
        </form>
        </Cartao>

        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Histórico recente</CartaoTitulo>
          </CartaoCabecalho>
          <div tabIndex={0} aria-label="Histórico recente" className="max-h-[420px] divide-y divide-linha overflow-auto">
            {execucoes.length ? (
              execucoes.map((execucao) => (
                <div key={execucao.id} className="grid gap-2 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="truncate">{execucao.resultado.simulacao === true ? 'Simulação' : 'Execução'}</strong>
                    <span className="rounded-sm bg-superficie-hover px-2 py-1 text-xs font-semibold text-texto-suave">
                      {execucao.status}
                    </span>
                  </div>
                  <p className="break-all text-xs text-texto-suave">Regra: {execucao.regraId}</p>
                  {execucao.resultado.gatilho === GATILHO_INATIVIDADE && Array.isArray(execucao.resultado.candidatos) ? (
                    <ResumoRecall
                      candidatos={execucao.resultado.candidatos as CandidatoRecallApi[]}
                      excluidos={(execucao.resultado.excluidos ?? []) as ExclusaoRecallApi[]}
                      pacientes={pacientes?.itens ?? []}
                    />
                  ) : (
                    <p className="break-all text-xs text-texto-suave">Resultado: {resumirJson(execucao.resultado)}</p>
                  )}
                </div>
              ))
            ) : (
              <EstadoVazio titulo="Nenhuma avaliação persistida." />
            )}
          </div>
        </Cartao>
      </section>
    </section>
  );
}
