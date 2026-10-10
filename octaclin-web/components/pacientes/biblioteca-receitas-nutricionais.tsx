'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Archive, BookOpenCheck, Plus, Send, UtensilsCrossed } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Selecao } from '@/components/ui/campo';
import { AlertaOperacional } from '@/components/ui/feedback';
import { ModalConfirmacao } from '@/components/ui/modal';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import {
  arquivarReceitaNutricional,
  criarReceitaNutricional,
  atualizarReceitaNutricional,
  listarReceitasNutricionais,
  obterConsentimentoPacienteReceitas,
  obterReceitaNutricional,
  compartilharReceitasNutricionais,
  listarEnviosReceitaPaciente,
  retirarCompartilhamentoReceita,
  type ConsentimentoReceitaApi,
  type EnvioReceitaClinicaApi,
  type ItemPlanoAlimentarEntrada,
  type OrigemReceitaNutricionalApi,
  type ReceitaNutricionalResumoApi,
  type TipoReceitaNutricionalApi
} from '@/lib/plano-alimentar-api';

interface RefeicaoDisponivel {
  chave: string;
  nome: string;
  itens: ItemPlanoAlimentarEntrada[];
}

interface BibliotecaReceitasNutricionaisProps {
  pacienteId: string;
  refeicoes: () => RefeicaoDisponivel[];
  aoInserir: (chaveRefeicao: string, itens: ItemPlanoAlimentarEntrada[]) => void;
  desabilitado?: boolean;
}

const ROTULO_TIPO: Record<TipoReceitaNutricionalApi, string> = {
  receita: 'Receita',
  refeicao_pronta: 'Refeição pronta'
};

/**
 * Biblioteca que nunca grava diretamente no plano. Aplicar so atualiza o
 * formulario local; o salvamento do rascunho e quem revalida e calcula.
 */
export function BibliotecaReceitasNutricionais({
  pacienteId,
  refeicoes,
  aoInserir,
  desabilitado = false
}: BibliotecaReceitasNutricionaisProps) {
  const id = useId();
  const [itens, setItens] = useState<ReceitaNutricionalResumoApi[]>([]);
  const [selecionada, setSelecionada] = useState('');
  const [refeicaoDestino, setRefeicaoDestino] = useState(() => refeicoes()[0]?.chave ?? '');
  const [nome, setNome] = useState('');
  const [origem, setOrigem] = useState<OrigemReceitaNutricionalApi>('pessoal');
  const [tipo, setTipo] = useState<TipoReceitaNutricionalApi>('receita');
  const [categoria, setCategoria] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [selecionadasCompartilhar, setSelecionadasCompartilhar] = useState<string[]>([]);
  const [consentimentosPaciente, setConsentimentosPaciente] = useState<ConsentimentoReceitaApi>({ email: false, whatsapp: false, push: false });
  const [canaisCompartilhamento, setCanaisCompartilhamento] = useState<Array<'email' | 'whatsapp' | 'push'>>([]);
  const [agendadoPara, setAgendadoPara] = useState('');
  const [confirmacaoRevisaoManual, setConfirmacaoRevisaoManual] = useState(false);
  const [instrucoes, setInstrucoes] = useState('');
  const [ocupado, setOcupado] = useState<'carregando' | 'aplicando' | 'salvando' | 'arquivando' | 'compartilhando' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmarArquivo, setConfirmarArquivo] = useState(false);
  const [confirmarCompartilhamento, setConfirmarCompartilhamento] = useState(false);
  const [enviosPaciente, setEnviosPaciente] = useState<EnvioReceitaClinicaApi[]>([]);
  const [compartilhamentoRetirar, setCompartilhamentoRetirar] = useState<EnvioReceitaClinicaApi | null>(null);
  const chaveIdempotenciaCompartilhamento = useRef('');
  const [idEmEdicao, setIdEmEdicao] = useState<string | null>(null);
  const [versaoEmEdicao, setVersaoEmEdicao] = useState<number | null>(null);
  const [itensEmEdicao, setItensEmEdicao] = useState<ItemPlanoAlimentarEntrada[]>([]);

  const refeicoesAtuais = refeicoes();
  const refeicaoDestinoAtual = refeicoesAtuais.some((refeicao) => refeicao.chave === refeicaoDestino)
    ? refeicaoDestino
    : (refeicoesAtuais[0]?.chave ?? '');
  const receitaAtual = useMemo(() => itens.find((item) => item.id === selecionada), [itens, selecionada]);

  const carregar = useCallback(async () => {
    setOcupado('carregando');
    setErro(null);
    try {
      const pagina = await listarReceitasNutricionais({ pagina: 1, limite: 100, categoria: filtroCategoria.trim() || undefined });
      setItens(pagina.itens);
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível carregar as receitas.'));
    } finally {
      setOcupado(null);
    }
  }, [filtroCategoria]);

  useEffect(() => {
    const agendamento = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(agendamento);
  }, [carregar]);

  const carregarEnviosEConsentimento = useCallback(async () => {
    try {
      const [consentimentos, envios] = await Promise.all([
        obterConsentimentoPacienteReceitas(pacienteId),
        listarEnviosReceitaPaciente(pacienteId)
      ]);
      setConsentimentosPaciente(consentimentos); setEnviosPaciente(envios);
    } catch {
      setConsentimentosPaciente({ email: false, whatsapp: false, push: false });
      setEnviosPaciente([]);
    }
  }, [pacienteId]);

  useEffect(() => {
    const agendamento = window.setTimeout(() => { void carregarEnviosEConsentimento(); }, 0);
    return () => window.clearTimeout(agendamento);
  }, [carregarEnviosEConsentimento]);

  async function aplicar() {
    if (!selecionada || !refeicaoDestinoAtual) return;
    setOcupado('aplicando');
    setErro(null);
    setAviso(null);
    try {
      const receita = await obterReceitaNutricional(selecionada);
      if (receita.alimentosIndisponiveis.length) {
        setErro(
          `${receita.alimentosIndisponiveis.length} alimento(s) desta receita sairam do catalogo ativo. Revise a receita antes de aplicar.`
        );
        return;
      }
      aoInserir(refeicaoDestinoAtual, receita.itens);
      setAviso(`${ROTULO_TIPO[receita.tipo]} inserida no rascunho. Salve o plano para recalcular os totais.`);
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível aplicar a receita.'));
    } finally {
      setOcupado(null);
    }
  }

  async function salvar() {
    const refeicao = refeicoesAtuais.find((item) => item.chave === refeicaoDestinoAtual);
    if (!nome.trim()) {
      setErro('Informe um nome para salvar na biblioteca.');
      return;
    }
    const itensSalvar = idEmEdicao ? itensEmEdicao : refeicao?.itens;
    if (!itensSalvar?.length) {
      setErro('Escolha uma refeição com ao menos um alimento para salvar.');
      return;
    }
    if (!categoria.trim()) {
      setErro('Informe uma categoria interna para a receita.');
      return;
    }
    setOcupado('salvando');
    setErro(null);
    setAviso(null);
    try {
      const entrada = {
        nome: nome.trim(),
        origem,
        tipo,
        categoria: categoria.trim(),
        instrucoes: instrucoes.trim() || undefined,
        itens: itensSalvar
      };
      if (idEmEdicao && versaoEmEdicao) {
        await atualizarReceitaNutricional(idEmEdicao, { ...entrada, versaoEsperada: versaoEmEdicao });
      } else {
        await criarReceitaNutricional(entrada);
      }
      setNome('');
      setCategoria('');
      setInstrucoes('');
      setIdEmEdicao(null); setVersaoEmEdicao(null); setItensEmEdicao([]);
      setAviso('Receita salva na biblioteca. Envios anteriores continuam com a versão recebida.');
      await carregar();
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível salvar a receita.'));
    } finally {
      setOcupado(null);
    }
  }

  async function editarSelecionada() {
    if (!selecionada) return;
    setOcupado('carregando'); setErro(null);
    try {
      const receita = await obterReceitaNutricional(selecionada);
      setIdEmEdicao(receita.id); setVersaoEmEdicao(receita.versaoAtual);
      setNome(receita.nome); setOrigem(receita.origem); setTipo(receita.tipo);
      setCategoria(receita.categoria ?? ''); setInstrucoes(receita.instrucoes ?? ''); setItensEmEdicao(receita.itens);
      setAviso('Edite os dados e salve. A receita já recebida pelo paciente não será alterada.');
    } catch (falha) { setErro(mensagemFalhaInterface(falha, 'Não foi possível abrir a receita para edição.')); }
    finally { setOcupado(null); }
  }

  async function arquivar() {
    if (!selecionada) return;
    setOcupado('arquivando');
    setErro(null);
    setAviso(null);
    try {
      await arquivarReceitaNutricional(selecionada);
      setSelecionada('');
      setConfirmarArquivo(false);
      setAviso('Item arquivado da biblioteca. Planos publicados não foram alterados.');
      await carregar();
    } catch (falha) {
      setErro(mensagemFalhaInterface(falha, 'Não foi possível arquivar a receita.'));
    } finally {
      setOcupado(null);
    }
  }

  async function compartilhar() {
    if (!selecionadasCompartilhar.length || selecionadasCompartilhar.length > 10) return;
    setOcupado('compartilhando'); setErro(null); setAviso(null);
    try {
      const resultado = await compartilharReceitasNutricionais({
        pacienteId,
        chaveIdempotencia: chaveIdempotenciaCompartilhamento.current || (chaveIdempotenciaCompartilhamento.current = crypto.randomUUID()),
        receitaIds: selecionadasCompartilhar,
        versoesEsperadas: selecionadasCompartilhar.map((receitaId) => {
          const item = itens.find((receita) => receita.id === receitaId);
          return { receitaId, versao: item?.versaoAtual ?? 0 };
        }),
        canais: ['portal', ...canaisCompartilhamento],
        agendadoPara: agendadoPara ? new Date(agendadoPara).toISOString() : undefined,
        confirmacaoRevisaoManual
      });
      setAviso(`${resultado.quantidade} receita(s) ${agendadoPara ? 'agendada(s)' : 'compartilhada(s)'} no portal. Os avisos externos não incluem o conteúdo.`);
      setSelecionadasCompartilhar([]); setAgendadoPara(''); setConfirmacaoRevisaoManual(false); setConfirmarCompartilhamento(false);
      chaveIdempotenciaCompartilhamento.current = '';
      await carregarEnviosEConsentimento();
    } catch (falha) { setErro(mensagemFalhaInterface(falha, 'Não foi possível compartilhar as receitas.')); }
    finally { setOcupado(null); }
  }

  async function retirarEnvio() {
    if (!compartilhamentoRetirar) return;
    setOcupado('compartilhando'); setErro(null);
    try {
      await retirarCompartilhamentoReceita(compartilhamentoRetirar.id);
      setCompartilhamentoRetirar(null); setAviso('Acesso do paciente revogado; o histórico foi preservado.');
      await carregarEnviosEConsentimento();
    } catch (falha) { setErro(mensagemFalhaInterface(falha, 'Não foi possível retirar este compartilhamento.')); }
    finally { setOcupado(null); }
  }

  return (
    <section className="grid gap-3 rounded-md border border-linha bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <UtensilsCrossed aria-hidden="true" size={17} className="text-primaria" />
          <div>
            <h3 className="text-sm font-semibold text-tinta">Receitas e refeições prontas</h3>
            <p className="text-sm text-texto-suave">Insira itens no rascunho ou salve uma refeição para reutilizar.</p>
          </div>
        </div>
        <Botao type="button" tamanho="sm" onClick={() => void carregar()} disabled={desabilitado || ocupado !== null}>
          <BookOpenCheck size={15} /> Atualizar biblioteca
        </Botao>
      </div>

      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {aviso ? <p role="status" className="rounded-md border border-sucesso-borda bg-sucesso-suave p-3 text-sm text-sucesso-forte">{aviso}</p> : null}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
        <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-filtro-categoria`}>
          Filtrar por categoria
          <Campo id={`${id}-filtro-categoria`} value={filtroCategoria} onChange={(evento) => setFiltroCategoria(evento.target.value)} maxLength={80} placeholder="Todas as categorias" disabled={desabilitado || ocupado !== null} />
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-selecionada`}>
          Biblioteca
          <Selecao id={`${id}-selecionada`} value={selecionada} onChange={(evento) => setSelecionada(evento.target.value)} disabled={desabilitado || ocupado !== null || !itens.length}>
            <option value="">{ocupado === 'carregando' ? 'Carregando...' : itens.length ? 'Escolha uma receita' : 'Nenhum item salvo'}</option>
            {itens.map((item) => <option key={item.id} value={item.id}>{item.nome} - {item.categoria ?? 'Sem categoria'} - {ROTULO_TIPO[item.tipo]} - {item.totalItens} item(ns)</option>)}
          </Selecao>
        </label>
        <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-destino`}>
          Inserir na refeição
          <Selecao id={`${id}-destino`} value={refeicaoDestinoAtual} onChange={(evento) => setRefeicaoDestino(evento.target.value)} disabled={desabilitado || ocupado !== null}>
            {refeicoesAtuais.map((refeicao, indice) => <option key={refeicao.chave} value={refeicao.chave}>{refeicao.nome.trim() || `Refeicao ${indice + 1}`}</option>)}
          </Selecao>
        </label>
        <div className="flex flex-wrap gap-2">
          <Botao type="button" onClick={() => void aplicar()} carregando={ocupado === 'aplicando'} disabled={desabilitado || !selecionada || !refeicaoDestinoAtual || ocupado !== null}>
            <Plus size={16} /> Inserir
          </Botao>
          <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => setConfirmarArquivo(true)} disabled={desabilitado || !receitaAtual || ocupado !== null} aria-label="Arquivar item selecionado da biblioteca">
            <Archive size={15} /> Arquivar
          </Botao>
          <Botao type="button" variante="secundario" tamanho="sm" onClick={() => void editarSelecionada()} disabled={desabilitado || !receitaAtual || ocupado !== null}>Editar</Botao>
        </div>
      </div>

      <fieldset className="grid gap-3 border-t border-linha pt-3">
        <legend className="px-1 text-sm font-semibold text-tinta">{idEmEdicao ? `Editar receita · versão ${versaoEmEdicao}` : 'Salvar refeição atual'}</legend>
        <div className="grid gap-3 md:grid-cols-3">
          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-nome`}>
            Nome
            <Campo id={`${id}-nome`} value={nome} onChange={(evento) => setNome(evento.target.value)} maxLength={180} disabled={desabilitado || ocupado !== null} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-tipo`}>
            Tipo
            <Selecao id={`${id}-tipo`} value={tipo} onChange={(evento) => setTipo(evento.target.value as TipoReceitaNutricionalApi)} disabled={desabilitado || ocupado !== null}>
              <option value="receita">Receita</option>
              <option value="refeicao_pronta">Refeição pronta</option>
            </Selecao>
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-categoria`}>
            Categoria interna
            <Campo id={`${id}-categoria`} value={categoria} onChange={(evento) => setCategoria(evento.target.value)} maxLength={80} required aria-describedby={`${id}-categoria-ajuda`} disabled={desabilitado || ocupado !== null} />
            <span id={`${id}-categoria-ajuda`} className="font-normal normal-case">Usada somente pela clínica; não aparece ao paciente.</span>
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-origem`}>
            Visibilidade
            <Selecao id={`${id}-origem`} value={origem} onChange={(evento) => setOrigem(evento.target.value as OrigemReceitaNutricionalApi)} disabled={desabilitado || ocupado !== null}>
              <option value="pessoal">Só para mim</option>
              <option value="clinica">Compartilhar com a clínica</option>
            </Selecao>
          </label>
        </div>
        <label className="grid gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-instrucoes`}>
          Instrucoes de preparo (opcional)
          <AreaTexto id={`${id}-instrucoes`} value={instrucoes} onChange={(evento) => setInstrucoes(evento.target.value)} maxLength={4000} disabled={desabilitado || ocupado !== null} />
        </label>
        {idEmEdicao ? <p className="text-sm text-texto-suave">Itens e quantidades preservados da versão selecionada. Para criar outro conteúdo, cancele a edição e salve a refeição atual.</p> : null}
        <div className="flex gap-2">
          {idEmEdicao ? <Botao type="button" variante="secundario" onClick={() => { setIdEmEdicao(null); setVersaoEmEdicao(null); setItensEmEdicao([]); setNome(''); setCategoria(''); setInstrucoes(''); }}>Cancelar edição</Botao> : null}
          <Botao type="button" onClick={() => void salvar()} carregando={ocupado === 'salvando'} disabled={desabilitado || (!idEmEdicao && !refeicaoDestino) || ocupado !== null}><Plus size={16} /> {idEmEdicao ? 'Salvar nova versão' : 'Salvar na biblioteca'}</Botao>
        </div>
      </fieldset>

      <section className="grid gap-3 border-t border-linha pt-3" aria-labelledby={`${id}-compartilhar-titulo`}>
        <div><h4 id={`${id}-compartilhar-titulo`} className="text-sm font-semibold">Compartilhar com este paciente</h4><p className="text-sm text-texto-suave">Escolha até 10 receitas. O conteúdo ficará somente no portal autenticado.</p></div>
        <div className="grid gap-2">{itens.map((item) => <label key={item.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={selecionadasCompartilhar.includes(item.id)} disabled={desabilitado || ocupado !== null || !item.categoria || (!selecionadasCompartilhar.includes(item.id) && selecionadasCompartilhar.length >= 10)} onChange={(evento) => setSelecionadasCompartilhar((atual) => evento.target.checked ? [...atual, item.id] : atual.filter((id) => id !== item.id))} />
          <span>{item.nome} · {item.categoria ?? 'Sem categoria — classifique antes de compartilhar'} · versão {item.versaoAtual}</span>
        </label>)}</div>
        <fieldset className="flex flex-wrap gap-4 text-sm" aria-label="Canais de aviso autorizados pelo paciente">
          <legend className="text-xs font-semibold uppercase text-texto-suave">Avisos externos (opcionais)</legend>
          {(['email', 'whatsapp', 'push'] as const).filter((canal) => consentimentosPaciente[canal]).map((canal) => <label key={canal} className="flex items-center gap-2">
            <input type="checkbox" checked={canaisCompartilhamento.includes(canal)} disabled={desabilitado || ocupado !== null} onChange={(evento) => setCanaisCompartilhamento((atual) => evento.target.checked ? [...atual, canal] : atual.filter((item) => item !== canal))} />
            {canal === 'email' ? 'E-mail' : canal === 'whatsapp' ? 'WhatsApp' : 'Push'}
          </label>)}
          {!(['email', 'whatsapp', 'push'] as const).some((canal) => consentimentosPaciente[canal]) ? <span className="text-texto-suave">Nenhum canal externo autorizado; a receita ficará no portal.</span> : null}
        </fieldset>
        <label className="grid max-w-sm gap-1 text-xs font-semibold uppercase text-texto-suave" htmlFor={`${id}-agendamento`}>
          Enviar agora ou agendar
          <input id={`${id}-agendamento`} type="datetime-local" value={agendadoPara} onChange={(evento) => setAgendadoPara(evento.target.value)} disabled={desabilitado || ocupado !== null} className="rounded-md border border-linha px-3 py-2 text-sm font-normal normal-case" />
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmacaoRevisaoManual} onChange={(evento) => setConfirmacaoRevisaoManual(evento.target.checked)} disabled={desabilitado || ocupado !== null} />Confirmo que revisei o conteúdo para este paciente.</label>
        <div><Botao type="button" onClick={() => setConfirmarCompartilhamento(true)} disabled={desabilitado || ocupado !== null || !selecionadasCompartilhar.length || !confirmacaoRevisaoManual}><Send size={16} /> Revisar e compartilhar ({selecionadasCompartilhar.length}/10)</Botao></div>
        {enviosPaciente.length ? <div className="grid gap-2 border-t border-linha pt-3">
          <h4 className="text-sm font-semibold">Envios para este paciente</h4>
          {enviosPaciente.map((envio) => <article key={envio.id} className="grid gap-2 rounded border border-linha p-3 text-sm">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><strong>{envio.nome}</strong><p className="text-xs text-texto-suave">Versão {envio.versao} · {envio.status === 'ativo' ? 'Disponível no portal' : envio.status === 'agendado' ? 'Agendada' : envio.status === 'substituido' ? 'Substituída' : 'Retirada'}</p></div>
              {envio.status === 'ativo' || envio.status === 'agendado' ? <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => setCompartilhamentoRetirar(envio)} disabled={ocupado !== null}>Retirar acesso</Botao> : null}</div>
            <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-texto-suave">{envio.entregas.map((entrega) => <li key={entrega.canal}>{entrega.canal === 'portal' ? 'Portal' : entrega.canal} · {entrega.status === 'enviado' ? 'confirmado' : entrega.status === 'incerto' ? 'envio não confirmado' : entrega.status === 'suprimido' ? 'não enviado' : entrega.status === 'pendente' ? 'aguardando' : entrega.status}</li>)}</ul>
            {envio.visualizadoEm ? <p className="text-xs text-texto-suave">Aberta em {new Date(envio.visualizadoEm).toLocaleString('pt-BR')}</p> : null}
          </article>)}
        </div> : null}
      </section>

      <ModalConfirmacao
        aberto={confirmarArquivo}
        titulo="Arquivar item da biblioteca"
        mensagem="O item deixara de aparecer para novos rascunhos. Planos já publicados permanecem inalterados."
        rotuloConfirmar="Arquivar"
        confirmando={ocupado === 'arquivando'}
        aoCancelar={() => setConfirmarArquivo(false)}
        aoConfirmar={() => void arquivar()}
      />
      <ModalConfirmacao
        aberto={Boolean(compartilhamentoRetirar)}
        titulo="Retirar receita do portal"
        mensagem={`O paciente perderá o acesso a ${compartilhamentoRetirar?.nome ?? 'esta receita'}. O registro histórico permanecerá na clínica.`}
        rotuloConfirmar="Retirar acesso"
        confirmando={ocupado === 'compartilhando'}
        aoCancelar={() => setCompartilhamentoRetirar(null)}
        aoConfirmar={() => void retirarEnvio()}
      />
      <ModalConfirmacao
        aberto={confirmarCompartilhamento}
        titulo="Confirmar compartilhamento"
        mensagem={`${selecionadasCompartilhar.map((receitaId) => {
          const item = itens.find((receita) => receita.id === receitaId);
          return item ? `${item.nome} · ${item.categoria} · versão ${item.versaoAtual}` : 'Receita atualizada — revise a seleção';
        }).join('; ')} serão disponibilizadas no portal deste paciente${canaisCompartilhamento.length ? `, com aviso por ${canaisCompartilhamento.join(', ')}` : ''}${agendadoPara ? ` em ${new Date(agendadoPara).toLocaleString('pt-BR')}` : ' imediatamente'}. Os avisos externos não incluem nomes nem conteúdo.`}
        rotuloConfirmar={agendadoPara ? 'Agendar envio' : 'Compartilhar agora'}
        confirmando={ocupado === 'compartilhando'}
        aoCancelar={() => setConfirmarCompartilhamento(false)}
        aoConfirmar={() => void compartilhar()}
      />
    </section>
  );
}
