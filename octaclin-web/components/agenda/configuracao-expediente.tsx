'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo } from '@/components/ui/cartao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { Aviso, EstadoVazio } from '@/components/ui/feedback';
import {
  arquivarTipoAtendimentoAgenda,
  criarTipoAtendimentoAgenda,
  listarTiposAtendimentoAgenda,
  obterExpedienteAgenda,
  salvarExpedienteAgenda,
  type FaixaExpedienteApi,
  type TipoAtendimentoApi
} from '@/lib/agenda-api';
import { ProfissionalResumo } from '@/lib/cadastros-api';
import { obterSessao } from '@/lib/auth-api';
import { classificarFalhaInterface } from '@/lib/erros-interface';

const DIAS_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

interface FaixaEditavel {
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
}

function faixaPadrao(): FaixaEditavel {
  return { diaSemana: 1, horaInicio: '08:00', horaFim: '18:00' };
}

function paraFaixaEditavel(item: FaixaExpedienteApi): FaixaEditavel {
  return { diaSemana: item.diaSemana, horaInicio: item.horaInicio, horaFim: item.horaFim };
}

export interface ConfiguracaoExpedienteProps {
  profissionais: ProfissionalResumo[];
}

/**
 * PB-18 (Fase 276): tipos de atendimento (duracao reutilizavel ao rotacionar o
 * link publico) e expediente semanal por profissional (restringe apenas o
 * agendamento publico, conforme escopo confirmado pelo proprietario).
 */
export function ConfiguracaoExpediente({ profissionais }: ConfiguracaoExpedienteProps) {
  const [papel, setPapel] = useState<string | null>(null);
  const [profissionalId, setProfissionalId] = useState('');

  const [tipos, setTipos] = useState<TipoAtendimentoApi[]>([]);
  const [carregandoTipos, setCarregandoTipos] = useState(true);
  const [novoTipoNome, setNovoTipoNome] = useState('');
  const [novoTipoDuracao, setNovoTipoDuracao] = useState('50');
  const [salvandoTipo, setSalvandoTipo] = useState(false);
  const [arquivandoTipoId, setArquivandoTipoId] = useState<string | null>(null);
  const [falhaTipos, setFalhaTipos] = useState<string | null>(null);

  const [faixas, setFaixas] = useState<FaixaEditavel[]>([]);
  const [carregandoExpediente, setCarregandoExpediente] = useState(false);
  const [salvandoExpediente, setSalvandoExpediente] = useState(false);
  const [falhaExpediente, setFalhaExpediente] = useState<string | null>(null);
  const [sucessoExpediente, setSucessoExpediente] = useState(false);

  useEffect(() => {
    let ativo = true;
    void obterSessao()
      .then((sessao) => {
        if (ativo) setPapel(sessao?.papel ?? '');
      })
      .catch(() => {
        if (ativo) setPapel('');
      });
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    if (papel && papel !== 'Professional' && !profissionalId && profissionais.length) {
      setProfissionalId(profissionais[0].id);
    }
  }, [papel, profissionais, profissionalId]);

  useEffect(() => {
    let ativo = true;
    setCarregandoTipos(true);
    listarTiposAtendimentoAgenda()
      .then((itens) => {
        if (ativo) setTipos(itens);
      })
      .catch((erro) => {
        if (ativo) setFalhaTipos(classificarFalhaInterface(erro, 'Não foi possível carregar os tipos de atendimento.').mensagem);
      })
      .finally(() => {
        if (ativo) setCarregandoTipos(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  const exigeSelecaoProfissional = papel !== null && papel !== 'Professional';
  const profissionalPronto = papel === 'Professional' || (exigeSelecaoProfissional && Boolean(profissionalId));

  useEffect(() => {
    if (!profissionalPronto) return;
    let ativo = true;
    setCarregandoExpediente(true);
    setFalhaExpediente(null);
    obterExpedienteAgenda(exigeSelecaoProfissional ? profissionalId : undefined)
      .then((itens) => {
        if (ativo) setFaixas(itens.map(paraFaixaEditavel));
      })
      .catch((erro) => {
        if (ativo) setFalhaExpediente(classificarFalhaInterface(erro, 'Não foi possível carregar o expediente.').mensagem);
      })
      .finally(() => {
        if (ativo) setCarregandoExpediente(false);
      });
    return () => {
      ativo = false;
    };
  }, [profissionalPronto, exigeSelecaoProfissional, profissionalId]);

  async function criarTipo(evento: FormEvent) {
    evento.preventDefault();
    const nome = novoTipoNome.trim();
    const duracao = Number(novoTipoDuracao);
    if (!nome || !Number.isFinite(duracao) || duracao < 5) return;
    setSalvandoTipo(true);
    setFalhaTipos(null);
    try {
      const criado = await criarTipoAtendimentoAgenda({ nome, duracaoMinutos: duracao });
      setTipos((atual) => [...atual, criado]);
      setNovoTipoNome('');
      setNovoTipoDuracao('50');
    } catch (erro) {
      setFalhaTipos(classificarFalhaInterface(erro, 'Não foi possível criar o tipo de atendimento.').mensagem);
    } finally {
      setSalvandoTipo(false);
    }
  }

  async function arquivarTipo(tipoId: string) {
    setArquivandoTipoId(tipoId);
    setFalhaTipos(null);
    try {
      await arquivarTipoAtendimentoAgenda(tipoId);
      setTipos((atual) => atual.map((tipo) => (tipo.id === tipoId ? { ...tipo, ativo: false } : tipo)));
    } catch (erro) {
      setFalhaTipos(classificarFalhaInterface(erro, 'Não foi possível arquivar o tipo de atendimento.').mensagem);
    } finally {
      setArquivandoTipoId(null);
    }
  }

  function adicionarFaixa() {
    setFaixas((atual) => [...atual, faixaPadrao()]);
    setSucessoExpediente(false);
  }

  function removerFaixa(indice: number) {
    setFaixas((atual) => atual.filter((_, i) => i !== indice));
    setSucessoExpediente(false);
  }

  function atualizarFaixa(indice: number, alteracao: Partial<FaixaEditavel>) {
    setFaixas((atual) => atual.map((faixa, i) => (i === indice ? { ...faixa, ...alteracao } : faixa)));
    setSucessoExpediente(false);
  }

  async function salvarExpediente(evento: FormEvent) {
    evento.preventDefault();
    setSalvandoExpediente(true);
    setFalhaExpediente(null);
    setSucessoExpediente(false);
    try {
      const salvo = await salvarExpedienteAgenda({
        profissionalId: exigeSelecaoProfissional ? profissionalId : undefined,
        faixas: faixas.map(({ diaSemana, horaInicio, horaFim }) => ({ diaSemana, horaInicio, horaFim }))
      });
      setFaixas(salvo.map(paraFaixaEditavel));
      setSucessoExpediente(true);
    } catch (erro) {
      setFalhaExpediente(classificarFalhaInterface(erro, 'Não foi possível salvar o expediente.').mensagem);
    } finally {
      setSalvandoExpediente(false);
    }
  }

  const tiposAtivos = useMemo(() => tipos.filter((tipo) => tipo.ativo), [tipos]);
  const tiposArquivados = useMemo(() => tipos.filter((tipo) => !tipo.ativo), [tipos]);

  return (
    <Cartao className="min-w-0">
      <CartaoCabecalho className="items-start">
        <div>
          <h2 className="text-base font-semibold">Expediente e tipos de atendimento</h2>
          <p className="mt-1 text-sm text-texto-suave">
            Restrinja o agendamento público a horários de expediente e defina durações reutilizáveis por tipo de atendimento.
          </p>
        </div>
      </CartaoCabecalho>
      <CartaoConteudo className="grid gap-6">
        <section className="grid gap-3">
          <h3 className="text-sm font-semibold text-tinta">Tipos de atendimento</h3>
          {falhaTipos ? <Aviso variante="erro" mensagem={falhaTipos} aoFechar={() => setFalhaTipos(null)} /> : null}

          <form onSubmit={(evento) => void criarTipo(evento)} className="flex flex-wrap items-end gap-2">
            <div className="grid gap-1">
              <Rotulo htmlFor="novo-tipo-nome">Nome</Rotulo>
              <Campo
                id="novo-tipo-nome"
                value={novoTipoNome}
                onChange={(evento) => setNovoTipoNome(evento.target.value)}
                maxLength={120}
                placeholder="Ex.: Primeira consulta"
                className="w-48"
              />
            </div>
            <div className="grid gap-1">
              <Rotulo htmlFor="novo-tipo-duracao">Duração (min)</Rotulo>
              <Campo
                id="novo-tipo-duracao"
                type="number"
                min={5}
                max={480}
                value={novoTipoDuracao}
                onChange={(evento) => setNovoTipoDuracao(evento.target.value)}
                className="w-28"
              />
            </div>
            <Botao type="submit" variante="secundario" carregando={salvandoTipo} disabled={!novoTipoNome.trim()}>
              <Plus size={16} />
              Adicionar tipo
            </Botao>
          </form>

          {carregandoTipos ? (
            <p className="text-sm text-texto-suave">Carregando tipos de atendimento...</p>
          ) : tiposAtivos.length ? (
            <ul className="grid gap-2">
              {tiposAtivos.map((tipo) => (
                <li key={tipo.id} className="flex items-center justify-between gap-2 rounded-md border border-linha px-3 py-2 text-sm">
                  <span>
                    {tipo.nome} · {tipo.duracaoMinutos} min
                  </span>
                  <Botao type="button" tamanho="sm" onClick={() => void arquivarTipo(tipo.id)} carregando={arquivandoTipoId === tipo.id}>
                    <Trash2 size={14} />
                    Arquivar
                  </Botao>
                </li>
              ))}
            </ul>
          ) : (
            <EstadoVazio
              titulo="Nenhum tipo de atendimento"
              descricao="Crie tipos reutilizáveis para escolher a duração ao rotacionar o link público."
            />
          )}
          {tiposArquivados.length ? (
            <p className="text-xs text-texto-suave">{tiposArquivados.length} tipo(s) arquivado(s) não aparecem para novo uso.</p>
          ) : null}
        </section>

        <section className="grid gap-3 border-t border-linha pt-4">
          <h3 className="text-sm font-semibold text-tinta">Expediente semanal</h3>
          <p className="text-sm text-texto-suave">Sem faixas cadastradas, o agendamento público aceita qualquer horário livre, como hoje.</p>

          {exigeSelecaoProfissional ? (
            <div className="grid max-w-sm gap-1">
              <Rotulo htmlFor="expediente-profissional">Profissional</Rotulo>
              <Selecao
                id="expediente-profissional"
                value={profissionalId}
                onChange={(evento) => {
                  setProfissionalId(evento.target.value);
                  setSucessoExpediente(false);
                }}
                disabled={!profissionais.length}
              >
                {!profissionais.length ? <option value="">Nenhum profissional cadastrado</option> : null}
                {profissionais.map((profissional) => (
                  <option key={profissional.id} value={profissional.id}>
                    {profissional.nome}
                  </option>
                ))}
              </Selecao>
            </div>
          ) : null}

          {falhaExpediente ? <Aviso variante="erro" mensagem={falhaExpediente} aoFechar={() => setFalhaExpediente(null)} /> : null}
          {sucessoExpediente ? <Aviso variante="sucesso" mensagem="Expediente salvo." aoFechar={() => setSucessoExpediente(false)} /> : null}

          {carregandoExpediente ? (
            <p className="text-sm text-texto-suave">Carregando expediente...</p>
          ) : (
            <form onSubmit={(evento) => void salvarExpediente(evento)} className="grid gap-3">
              {faixas.map((faixa, indice) => (
                <div key={indice} className="flex flex-wrap items-end gap-2">
                  <div className="grid gap-1">
                    <Rotulo htmlFor={`faixa-dia-${indice}`}>Dia</Rotulo>
                    <Selecao
                      id={`faixa-dia-${indice}`}
                      value={faixa.diaSemana}
                      onChange={(evento) => atualizarFaixa(indice, { diaSemana: Number(evento.target.value) })}
                      className="w-40"
                    >
                      {DIAS_SEMANA.map((nome, dia) => (
                        <option key={dia} value={dia}>
                          {nome}
                        </option>
                      ))}
                    </Selecao>
                  </div>
                  <div className="grid gap-1">
                    <Rotulo htmlFor={`faixa-inicio-${indice}`}>Início</Rotulo>
                    <Campo
                      id={`faixa-inicio-${indice}`}
                      type="time"
                      value={faixa.horaInicio}
                      onChange={(evento) => atualizarFaixa(indice, { horaInicio: evento.target.value })}
                      className="w-28"
                    />
                  </div>
                  <div className="grid gap-1">
                    <Rotulo htmlFor={`faixa-fim-${indice}`}>Fim</Rotulo>
                    <Campo
                      id={`faixa-fim-${indice}`}
                      type="time"
                      value={faixa.horaFim}
                      onChange={(evento) => atualizarFaixa(indice, { horaFim: evento.target.value })}
                      className="w-28"
                    />
                  </div>
                  <Botao type="button" tamanho="sm" onClick={() => removerFaixa(indice)} aria-label="Remover faixa">
                    <Trash2 size={14} />
                  </Botao>
                </div>
              ))}

              <div className="flex flex-wrap items-center gap-2">
                <Botao type="button" onClick={adicionarFaixa} disabled={faixas.length >= 28}>
                  <Plus size={16} />
                  Adicionar faixa
                </Botao>
                <Botao
                  type="submit"
                  variante="primario"
                  carregando={salvandoExpediente}
                  disabled={exigeSelecaoProfissional && !profissionalId}
                >
                  Salvar expediente
                </Botao>
              </div>
            </form>
          )}
        </section>
      </CartaoConteudo>
    </Cartao>
  );
}
