'use client';

import { useId, useState } from 'react';
import { CopyPlus, Search } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional } from '@/components/ui/feedback';
import { listarPacientes, type PacienteResumo } from '@/lib/cadastros-api';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import {
  listarPlanosAlimentares,
  obterPlanoAlimentar,
  type PlanoAlimentarResumoApi,
  type VersaoPlanoAlimentarApi
} from '@/lib/plano-alimentar-api';

export interface DuplicarPlanoDeOutroPacienteProps {
  /** Paciente deste rascunho: fica fora da busca, duplicar dele mesmo nao faz sentido. */
  pacienteIdAtual: string;
  /** Recebe a versao de origem; o chamador converte as refeicoes como ja faz com modelo. */
  aoAplicar: (versao: VersaoPlanoAlimentarApi) => void;
  desabilitado?: boolean;
}

/** Prefere a publicada: e o plano que de fato esta valendo para o paciente de origem. */
function versaoParaCopiar(plano: { current?: VersaoPlanoAlimentarApi; draft?: VersaoPlanoAlimentarApi }) {
  return plano.current ?? plano.draft;
}

function descreverPlano(plano: PlanoAlimentarResumoApi) {
  if (plano.current) return `${plano.titulo} - publicado (v${plano.current.numero})`;
  if (plano.draft) return `${plano.titulo} - rascunho (v${plano.draft.numero})`;
  return `${plano.titulo} - sem versao com refeições`;
}

export function DuplicarPlanoDeOutroPaciente({
  pacienteIdAtual,
  aoAplicar,
  desabilitado = false
}: DuplicarPlanoDeOutroPacienteProps) {
  const id = useId();
  const [termo, setTermo] = useState('');
  const [pacientes, setPacientes] = useState<PacienteResumo[]>([]);
  const [buscou, setBuscou] = useState(false);
  const [pacienteOrigemId, setPacienteOrigemId] = useState('');
  const [planos, setPlanos] = useState<PlanoAlimentarResumoApi[]>([]);
  const [planoId, setPlanoId] = useState('');
  const [ocupado, setOcupado] = useState<'buscando' | 'carregando-planos' | 'duplicando' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function buscar() {
    if (!termo.trim()) return;
    setOcupado('buscando');
    setErro(null);
    setAviso(null);
    setPacienteOrigemId('');
    setPlanos([]);
    setPlanoId('');
    try {
      const pagina = await listarPacientes({ busca: termo.trim(), limite: 10 });
      // O backend ja limita a busca ao escopo do profissional; aqui so tiramos
      // o proprio paciente, que nunca e uma origem util.
      setPacientes(pagina.itens.filter((paciente) => paciente.id !== pacienteIdAtual));
      setBuscou(true);
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível buscar pacientes.'));
    } finally {
      setOcupado(null);
    }
  }

  async function selecionarPaciente(novoPacienteId: string) {
    setPacienteOrigemId(novoPacienteId);
    setPlanos([]);
    setPlanoId('');
    setAviso(null);
    if (!novoPacienteId) return;
    setOcupado('carregando-planos');
    setErro(null);
    try {
      const pagina = await listarPlanosAlimentares(novoPacienteId, { pagina: 1, limite: 25 });
      setPlanos(pagina.itens);
      if (!pagina.itens.length) setAviso('Esse paciente ainda não tem plano alimentar para duplicar.');
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível carregar os planos desse paciente.'));
    } finally {
      setOcupado(null);
    }
  }

  async function duplicar() {
    if (!pacienteOrigemId || !planoId) return;
    setOcupado('duplicando');
    setErro(null);
    setAviso(null);
    try {
      const plano = await obterPlanoAlimentar(pacienteOrigemId, planoId);
      const versao = versaoParaCopiar(plano);
      if (!versao?.refeicoes.length) {
        setErro('O plano escolhido não tem refeições para duplicar.');
        return;
      }
      aoAplicar(versao);
      setAviso('Refeições duplicadas para o rascunho. Revise as quantidades e salve para recalcular.');
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível duplicar o plano.'));
    } finally {
      setOcupado(null);
    }
  }

  return (
    <section aria-labelledby={`${id}-titulo`} className="grid gap-3 rounded-md border border-linha bg-white p-4">
      <div className="flex items-center gap-2">
        <CopyPlus aria-hidden="true" size={17} className="text-primaria" />
        <h3 id={`${id}-titulo`} className="text-sm font-semibold text-tinta">
          Duplicar de outro paciente
        </h3>
      </div>

      <p className="text-xs text-texto-suave">
        Copia apenas as refeições e substituições. A avaliação antropométrica, o cálculo energético, o objetivo
        clínico e as confirmações continuam sendo os deste paciente.
      </p>

      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {aviso ? (
        <p role="status" className="rounded-md bg-superficie px-3 py-2 text-sm text-tinta">
          {aviso}
        </p>
      ) : null}

      {/* Sem <form> aqui: este bloco vive dentro do formulario do rascunho, e
          formulario aninhado e HTML invalido -- o Enter na busca acabaria
          submetendo o plano. O Enter e tratado no proprio campo. */}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="grid gap-1">
          <Rotulo htmlFor={`${id}-busca`}>Buscar paciente de origem</Rotulo>
          <Campo
            id={`${id}-busca`}
            value={termo}
            onChange={(evento) => setTermo(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key !== 'Enter') return;
              evento.preventDefault();
              void buscar();
            }}
            maxLength={120}
            placeholder="Buscar por nome"
            disabled={desabilitado}
          />
        </div>
        <Botao
          type="button"
          variante="secundario"
          className="min-h-11"
          onClick={() => void buscar()}
          carregando={ocupado === 'buscando'}
          disabled={desabilitado || !termo.trim() || Boolean(ocupado)}
        >
          <Search aria-hidden="true" size={15} />
          Buscar
        </Botao>
      </div>

      {buscou && !pacientes.length && ocupado !== 'buscando' ? (
        <p className="text-xs text-texto-suave">Nenhum outro paciente encontrado com esse nome.</p>
      ) : null}

      {pacientes.length ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <div className="grid gap-1">
            <Rotulo htmlFor={`${id}-paciente`}>Paciente</Rotulo>
            <Selecao
              id={`${id}-paciente`}
              value={pacienteOrigemId}
              onChange={(evento) => void selecionarPaciente(evento.target.value)}
              disabled={desabilitado || Boolean(ocupado)}
            >
              <option value="">Escolha um paciente</option>
              {pacientes.map((paciente) => (
                <option key={paciente.id} value={paciente.id}>
                  {paciente.nome}
                </option>
              ))}
            </Selecao>
          </div>
          <div className="grid gap-1">
            <Rotulo htmlFor={`${id}-plano`}>Plano</Rotulo>
            <Selecao
              id={`${id}-plano`}
              value={planoId}
              onChange={(evento) => setPlanoId(evento.target.value)}
              disabled={desabilitado || !planos.length || Boolean(ocupado)}
            >
              <option value="">{planos.length ? 'Escolha um plano' : 'Nenhum plano disponível'}</option>
              {planos.map((plano) => (
                <option key={plano.id} value={plano.id}>
                  {descreverPlano(plano)}
                </option>
              ))}
            </Selecao>
          </div>
          <Botao
            type="button"
            variante="primario"
            className="min-h-11"
            onClick={() => void duplicar()}
            carregando={ocupado === 'duplicando'}
            disabled={desabilitado || !planoId || Boolean(ocupado)}
          >
            Duplicar
          </Botao>
        </div>
      ) : null}

      {planoId ? (
        <p className="text-xs text-texto-suave">Duplicar substitui todas as refeições do rascunho atual.</p>
      ) : null}
    </section>
  );
}
