'use client';

import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Play, Plus, RefreshCcw, Save, SlidersHorizontal, Zap } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import {
  ExecucaoRegraApi,
  RegraAutomacaoApi,
  avaliarRegraAutomacao,
  carregarBootstrapAutomacoes,
  criarRegraAutomacao
} from '@/lib/automacoes-api';
import { PacienteResumo, ProfissionalResumo, RespostaPaginada } from '@/lib/cadastros-api';

interface FormularioRegra {
  profissionalId: string;
  nome: string;
  gatilhoTipo: string;
  campo: string;
  operador: 'igual' | 'maior_que' | 'maior_ou_igual' | 'menor_que' | 'inclui';
  valor: string;
  acaoTipo: string;
  ativa: boolean;
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
  ativa: true
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
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar automacoes.');
    } finally {
      setCarregando(false);
    }
  }

  async function salvarRegra(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(null);

    try {
      const criada = await criarRegraAutomacao({
        profissionalId: formularioRegra.profissionalId,
        nome: formularioRegra.nome.trim(),
        gatilho: { tipo: formularioRegra.gatilhoTipo },
        condicoes: [
          {
            campo: formularioRegra.campo,
            operador: formularioRegra.operador,
            valor: valorCondicao(formularioRegra.valor)
          }
        ],
        acoes: [{ tipo: formularioRegra.acaoTipo }],
        ativa: formularioRegra.ativa
      });
      setRegras((atuais) => [criada, ...atuais]);
      setFormularioAvaliacao((atual) => ({ ...atual, regraId: criada.id }));
      setSucesso('Regra criada.');
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao criar regra.');
    } finally {
      setSalvando(false);
    }
  }

  async function avaliar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(null);

    try {
      const execucao = await avaliarRegraAutomacao({
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
      setSucesso(`Avaliacao criada com status ${execucao.status}.`);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao avaliar regra.');
    } finally {
      setSalvando(false);
    }
  }

  useEffect(() => {
    void carregar();
  }, []);

  return (
    <section className="grid gap-4">
      <div className="flex flex-col gap-3 rounded-lg border border-linha bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-base font-semibold">Regras de automacao</h2>
          <p className="mt-1 text-sm text-[#596273]">
            {regras.length} regras, {execucoes.length} avaliacoes persistidas
          </p>
        </div>
        <Botao onClick={carregar} disabled={carregando}>
          <RefreshCcw size={16} />
          {carregando ? 'Atualizando' : 'Atualizar'}
        </Botao>
      </div>

      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      <BarraCarregamento visivel={carregando} />
      {sucesso ? (
        <div className="flex items-center gap-2 rounded-lg border border-[#b8dfc1] bg-[#eef7f0] px-4 py-3 text-sm text-[#245b33]">
          <CheckCircle2 size={16} />
          {sucesso}
        </div>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <form onSubmit={salvarRegra} className="rounded-lg border border-linha bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Plus size={18} className="text-primaria" />
            <h3 className="text-sm font-semibold">Nova regra</h3>
          </div>
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
                <option value="questionario.respondido">Questionario respondido</option>
                <option value="paciente.risco_alto">Paciente em risco alto</option>
              </Selecao>
            </div>
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
              <Rotulo htmlFor="regra-acao">Acao</Rotulo>
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
          </div>
          <label className="mt-3 flex items-center justify-between rounded-md border border-linha bg-[#f7f8fa] px-3 py-2">
            <span className="text-sm font-medium text-tinta">Ativa</span>
            <input
              type="checkbox"
              checked={formularioRegra.ativa}
              onChange={(evento) => setFormularioRegra((atual) => ({ ...atual, ativa: evento.target.checked }))}
              className="h-5 w-5 accent-primaria"
            />
          </label>
          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario" disabled={salvando || !profissionais?.itens.length}>
              <Save size={16} />
              Salvar regra
            </Botao>
          </div>
        </form>

        <aside className="rounded-lg border border-linha bg-white">
          <div className="flex items-center gap-2 border-b border-linha px-4 py-3">
            <SlidersHorizontal size={16} className="text-primaria" />
            <h3 className="text-sm font-semibold">Regras cadastradas</h3>
          </div>
          <div className="max-h-[520px] divide-y divide-linha overflow-auto">
            {regras.length ? (
              regras.map((regra) => (
                <div key={regra.id} className="grid gap-2 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="truncate">{regra.nome}</strong>
                    <span className="rounded-sm bg-[#eef3f6] px-2 py-1 text-xs font-semibold text-[#596273]">
                      {regra.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                  <p className="truncate text-xs text-[#596273]">{nomeProfissional(profissionais?.itens ?? [], regra.profissionalId)}</p>
                  <p className="break-all text-xs text-[#596273]">Gatilho: {resumirJson(regra.gatilho)}</p>
                  <p className="break-all text-xs text-[#596273]">Condicoes: {resumirJson(regra.condicoes)}</p>
                </div>
              ))
            ) : (
              <EstadoVazio titulo="Nenhuma regra carregada." />
            )}
          </div>
        </aside>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <form onSubmit={avaliar} className="rounded-lg border border-linha bg-white p-4">
          <div className="mb-3 flex items-center gap-2">
            <Play size={18} className="text-primaria" />
            <h3 className="text-sm font-semibold">Avaliar regra</h3>
          </div>
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
                {regras
                  .filter((regra) => regra.ativa)
                  .map((regra) => (
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
              <Rotulo htmlFor="avaliacao-status">Status</Rotulo>
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
              <Rotulo htmlFor="avaliacao-observacao">Observacao</Rotulo>
              <AreaTexto
                id="avaliacao-observacao"
                value={formularioAvaliacao.observacao}
                onChange={(evento) => setFormularioAvaliacao((atual) => ({ ...atual, observacao: evento.target.value }))}
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario" disabled={salvando || !formularioAvaliacao.regraId}>
              <Zap size={16} />
              Solicitar avaliacao
            </Botao>
          </div>
        </form>

        <aside className="rounded-lg border border-linha bg-white">
          <div className="border-b border-linha px-4 py-3">
            <h3 className="text-sm font-semibold">Avaliacoes recentes</h3>
          </div>
          <div className="max-h-[420px] divide-y divide-linha overflow-auto">
            {execucoes.length ? (
              execucoes.map((execucao) => (
                <div key={execucao.id} className="grid gap-2 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <strong className="truncate">{execucao.id}</strong>
                    <span className="rounded-sm bg-[#eef3f6] px-2 py-1 text-xs font-semibold text-[#596273]">
                      {execucao.status}
                    </span>
                  </div>
                  <p className="break-all text-xs text-[#596273]">Regra: {execucao.regraId}</p>
                  <p className="break-all text-xs text-[#596273]">Resultado: {resumirJson(execucao.resultado)}</p>
                </div>
              ))
            ) : (
              <EstadoVazio titulo="Nenhuma avaliacao persistida." />
            )}
          </div>
        </aside>
      </section>
    </section>
  );
}
