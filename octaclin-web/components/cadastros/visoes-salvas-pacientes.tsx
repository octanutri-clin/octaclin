'use client';

import { Bookmark, RefreshCcw, Save, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { ModalConfirmacao } from '@/components/ui/modal';
import {
  type CriteriosFiltroSalvoPaciente,
  type FiltroSalvoPaciente,
  type OrigemFiltroSalvoPaciente,
  type ProfissionalResumo,
  arquivarFiltroSalvoPaciente,
  criarFiltroSalvoPaciente,
  listarFiltrosSalvosPacientes,
  obterProfissional
} from '@/lib/cadastros-api';
import { classificarFalhaInterface } from '@/lib/erros-interface';

interface VisoesSalvasPacientesProps {
  criteriosAtuais: CriteriosFiltroSalvoPaciente;
  profissionais: ProfissionalResumo[];
  podeGerenciar: boolean;
  aoAplicar: (criterios: CriteriosFiltroSalvoPaciente) => void;
}

export function VisoesSalvasPacientes({ criteriosAtuais, profissionais, podeGerenciar, aoAplicar }: VisoesSalvasPacientesProps) {
  const [filtros, setFiltros] = useState<FiltroSalvoPaciente[]>([]);
  const [selecionadoId, setSelecionadoId] = useState('');
  const [criando, setCriando] = useState(false);
  const [nome, setNome] = useState('');
  const [origem, setOrigem] = useState<OrigemFiltroSalvoPaciente>('pessoal');
  const [processando, setProcessando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [estadoProfissional, setEstadoProfissional] = useState<'ocioso' | 'verificando' | 'disponivel' | 'indisponivel' | 'desconhecido'>('ocioso');
  const [confirmandoArquivamento, setConfirmandoArquivamento] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setFiltros((await listarFiltrosSalvosPacientes()).itens);
    } catch (erroAtual) {
      setErro(classificarFalhaInterface(erroAtual, 'Visões salvas indisponíveis. Os filtros manuais continuam funcionando.').mensagem);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    const atraso = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(atraso);
  }, [carregar]);

  const selecionado = filtros.find((filtro) => filtro.id === selecionadoId);

  function selecionar(filtroId: string) {
    const filtro = filtros.find((item) => item.id === filtroId);
    const profissionalId = filtro?.criterios.profissionalId;
    setSelecionadoId(filtroId);
    setEstadoProfissional(
      !profissionalId
        ? 'ocioso'
        : profissionais.some((profissional) => profissional.id === profissionalId)
          ? 'disponivel'
          : 'verificando'
    );
  }

  useEffect(() => {
    const profissionalId = selecionado?.criterios.profissionalId;
    if (!profissionalId || profissionais.some((profissional) => profissional.id === profissionalId)) return;

    let ativo = true;
    void obterProfissional(profissionalId)
      .then((profissional) => {
        if (ativo) setEstadoProfissional(profissional && !profissional.arquivadoEm ? 'disponivel' : 'indisponivel');
      })
      .catch(() => {
        if (ativo) setEstadoProfissional('desconhecido');
      });
    return () => { ativo = false; };
  }, [profissionais, selecionado]);

  const profissionalDesatualizado = estadoProfissional === 'indisponivel';

  function aplicar(removerProfissional = false) {
    if (!selecionado) return;
    const criterios = { ...selecionado.criterios };
    if (removerProfissional) delete criterios.profissionalId;
    aoAplicar(criterios);
  }

  async function salvar() {
    if (!nome.trim()) return;
    setProcessando(true);
    setErro(null);
    try {
      const criado = await criarFiltroSalvoPaciente({ nome: nome.trim(), origem, criterios: criteriosAtuais });
      setFiltros((atuais) => [criado, ...atuais]);
      setSelecionadoId(criado.id);
      setEstadoProfissional(
        !criado.criterios.profissionalId
          ? 'ocioso'
          : profissionais.some((profissional) => profissional.id === criado.criterios.profissionalId)
            ? 'disponivel'
            : 'verificando'
      );
      setNome('');
      setCriando(false);
    } catch (erroAtual) {
      setErro(classificarFalhaInterface(erroAtual, 'Não foi possível salvar esta visão.').mensagem);
    } finally {
      setProcessando(false);
    }
  }

  async function arquivar() {
    if (!selecionado) return;
    setProcessando(true);
    setErro(null);
    try {
      await arquivarFiltroSalvoPaciente(selecionado.id);
      setFiltros((atuais) => atuais.filter((filtro) => filtro.id !== selecionado.id));
      setSelecionadoId('');
      setEstadoProfissional('ocioso');
      setConfirmandoArquivamento(false);
    } catch (erroAtual) {
      setErro(classificarFalhaInterface(erroAtual, 'Não foi possível remover esta visão.').mensagem);
    } finally {
      setProcessando(false);
    }
  }

  const podeArquivar = Boolean(selecionado && (selecionado.origem === 'pessoal' || podeGerenciar));

  return (
    <>
    <section className="grid gap-3 border-t border-linha pt-4 lg:col-span-4" aria-labelledby="visoes-salvas-titulo">
      <h3 id="visoes-salvas-titulo" className="text-sm font-semibold text-tinta">Visões de trabalho</h3>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="grid min-w-0 flex-1 gap-1">
          <Rotulo htmlFor="visao-salva-paciente">Visão salva</Rotulo>
          <Selecao id="visao-salva-paciente" value={selecionadoId} onChange={(evento) => selecionar(evento.target.value)} disabled={carregando || !filtros.length}>
            <option value="">{carregando ? 'Carregando visões' : filtros.length ? 'Selecione uma visão' : 'Nenhuma visão salva'}</option>
            {filtros.some((filtro) => filtro.origem === 'pessoal') ? <optgroup label="Minhas visões">{filtros.filter((filtro) => filtro.origem === 'pessoal').map((filtro) => <option key={filtro.id} value={filtro.id}>{filtro.nome}</option>)}</optgroup> : null}
            {filtros.some((filtro) => filtro.origem === 'clinica') ? <optgroup label="Visões da clínica">{filtros.filter((filtro) => filtro.origem === 'clinica').map((filtro) => <option key={filtro.id} value={filtro.id}>{filtro.nome}</option>)}</optgroup> : null}
          </Selecao>
        </div>
        <div className="flex flex-wrap gap-2">
          <Botao type="button" variante="secundario" onClick={() => aplicar(false)} disabled={!selecionado || profissionalDesatualizado || estadoProfissional === 'verificando' || processando}><Bookmark size={16} />Aplicar</Botao>
          <Botao type="button" variante="fantasma" onClick={() => setCriando((atual) => !atual)} disabled={processando}><Save size={16} />Salvar visão</Botao>
          {podeArquivar ? <Botao type="button" variante="fantasma" onClick={() => setConfirmandoArquivamento(true)} disabled={processando} aria-label="Remover visão salva" title="Remover visão salva"><Trash2 size={16} /></Botao> : null}
        </div>
      </div>

      {profissionalDesatualizado ? (
        <div role="status" className="flex flex-col gap-2 rounded-md border border-alerta-borda bg-alerta-suave px-3 py-3 text-sm text-alerta-forte sm:flex-row sm:items-center">
          <span className="flex-1">Esta visão referencia um profissional que não está mais disponível.</span>
          <Botao type="button" tamanho="sm" variante="secundario" onClick={() => aplicar(true)}>Aplicar sem responsável</Botao>
        </div>
      ) : null}

      {estadoProfissional === 'desconhecido' ? (
        <p role="status" className="text-sm text-alerta-forte">Não foi possível confirmar o responsável desta visão. Você pode aplicá-la e ajustar o filtro se necessário.</p>
      ) : null}

      {criando ? (
        <div className="grid gap-3 rounded-md border border-linha bg-superficie-hover p-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end">
          <div className="grid gap-1"><Rotulo htmlFor="nome-visao-paciente">Nome da visão</Rotulo><Campo id="nome-visao-paciente" maxLength={80} value={nome} onChange={(evento) => setNome(evento.target.value)} placeholder="Ex.: Risco alto sem retorno" /></div>
          <div className="grid gap-1"><Rotulo htmlFor="origem-visao-paciente">Disponibilidade</Rotulo><Selecao id="origem-visao-paciente" value={origem} onChange={(evento) => setOrigem(evento.target.value as OrigemFiltroSalvoPaciente)}><option value="pessoal">Somente para mim</option>{podeGerenciar ? <option value="clinica">Equipe da clínica</option> : null}</Selecao></div>
          <Botao type="button" variante="primario" onClick={() => void salvar()} disabled={!nome.trim() || processando} carregando={processando}><Save size={16} />Salvar</Botao>
          <p className="text-xs text-texto-suave sm:col-span-3">A busca por nome ou contato não é incluída na visão salva.</p>
        </div>
      ) : null}

      {erro ? <div role="status" className="flex flex-wrap items-center gap-2 text-sm text-perigo"><span className="flex-1">{erro}</span><Botao type="button" tamanho="sm" variante="fantasma" onClick={() => void carregar()}><RefreshCcw size={14} />Tentar novamente</Botao></div> : null}
    </section>
    <ModalConfirmacao
      aberto={confirmandoArquivamento}
      titulo="Remover visão salva"
      mensagem={selecionado ? `Remover a visão ${selecionado.nome}? Os filtros atuais não serão alterados.` : 'Remover esta visão salva?'}
      rotuloConfirmar="Remover visão"
      confirmando={processando}
      aoConfirmar={() => void arquivar()}
      aoCancelar={() => setConfirmandoArquivamento(false)}
    />
    </>
  );
}
