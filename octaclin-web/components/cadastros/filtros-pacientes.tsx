'use client';

import { Search } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoConteudo } from '@/components/ui/cartao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import type { ProfissionalResumo } from '@/lib/cadastros-api';

interface FiltrosPacientesProps {
  busca: string;
  risco: 'todos' | 'alto' | 'medio' | 'baixo';
  profissional: string;
  status: string;
  semProximaConsulta: boolean;
  profissionais: ProfissionalResumo[];
  total: number;
  aoAlterarBusca: (valor: string) => void;
  aoAlterarRisco: (valor: 'todos' | 'alto' | 'medio' | 'baixo') => void;
  aoAlterarProfissional: (valor: string) => void;
  aoAlterarStatus: (valor: string) => void;
  aoAplicarVisao: (visao: 'todos' | 'prioridade' | 'sem-retorno') => void;
}

export function FiltrosPacientes(props: FiltrosPacientesProps) {
  return (
    <Cartao>
      <CartaoConteudo className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
        <label className="grid gap-1" htmlFor="busca-pacientes">
          <Rotulo>Buscar pacientes</Rotulo>
          <span className="relative">
            <Search aria-hidden="true" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-texto-suave" />
            <Campo id="busca-pacientes" value={props.busca} onChange={(evento) => props.aoAlterarBusca(evento.target.value)} placeholder="Nome ou contato (mínimo 3 caracteres)" className="pl-9" />
          </span>
        </label>
        <label className="grid gap-1" htmlFor="filtro-risco">
          <Rotulo>Risco</Rotulo>
          <Selecao id="filtro-risco" value={props.risco} onChange={(evento) => props.aoAlterarRisco(evento.target.value as FiltrosPacientesProps['risco'])}>
            <option value="todos">Todos os riscos</option><option value="alto">Alto</option><option value="medio">Médio</option><option value="baixo">Baixo</option>
          </Selecao>
        </label>
        <label className="grid gap-1" htmlFor="filtro-profissional">
          <Rotulo>Responsável</Rotulo>
          <Selecao id="filtro-profissional" value={props.profissional} onChange={(evento) => props.aoAlterarProfissional(evento.target.value)}>
            <option value="todos">Todos</option>{props.profissionais.map((profissional) => <option key={profissional.id} value={profissional.id}>{profissional.nome}</option>)}
          </Selecao>
        </label>
        <label className="grid gap-1" htmlFor="filtro-status">
          <Rotulo>Situação</Rotulo>
          <Selecao id="filtro-status" value={props.status} onChange={(evento) => props.aoAlterarStatus(evento.target.value)}>
            <option value="todos">Todas</option><option value="novo">Novo</option><option value="aderente">Aderente</option><option value="em_acompanhamento">Em acompanhamento</option><option value="risco">Risco</option>
          </Selecao>
        </label>
        <div className="flex flex-wrap gap-2 lg:col-span-4" aria-label="Visões rápidas">
          <Botao type="button" variante="fantasma" aria-pressed={!props.semProximaConsulta && props.risco === 'todos' && props.status === 'todos' && props.profissional === 'todos' && !props.busca} onClick={() => props.aoAplicarVisao('todos')}>Todos</Botao>
          <Botao type="button" variante="fantasma" aria-pressed={props.risco === 'alto'} onClick={() => props.aoAplicarVisao('prioridade')}>Alta prioridade</Botao>
          <Botao type="button" variante="fantasma" aria-pressed={props.semProximaConsulta} onClick={() => props.aoAplicarVisao('sem-retorno')}>Sem consulta futura</Botao>
          <span className="self-center text-xs text-texto-suave" aria-live="polite">{props.total} pacientes encontrados</span>
        </div>
      </CartaoConteudo>
    </Cartao>
  );
}
