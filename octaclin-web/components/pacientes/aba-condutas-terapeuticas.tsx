'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Archive, FilePenLine, Plus, Send, Stethoscope } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Rotulo } from '@/components/ui/campo';
import { AlertaOperacional, AlertaSucesso, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import { ModalConfirmacao } from '@/components/ui/modal';
import { arquivarCondutaTerapeutica, atualizarRascunhoCondutaTerapeutica, criarCondutaTerapeutica, criarNovaVersaoCondutaTerapeutica, listarCondutasTerapeuticas, publicarCondutaTerapeutica, type CondutaTerapeuticaApi, type TipoCondutaTerapeuticaApi } from '@/lib/condutas-terapeuticas-api';
import { mensagemFalhaInterface } from '@/lib/erros-interface';

const tipos: Array<{ id: TipoCondutaTerapeuticaApi; rotulo: string }> = [
  { id: 'meta', rotulo: 'Meta' }, { id: 'orientacao', rotulo: 'Orientação' }, { id: 'suplemento', rotulo: 'Suplemento' },
  { id: 'produto', rotulo: 'Produto' }, { id: 'formula_manipulada', rotulo: 'Fórmula manipulada' }
];

interface FormularioConduta { tipo: TipoCondutaTerapeuticaApi; titulo: string; conteudo: string; validadeInicio: string; validadeFim: string; }
const formularioInicial: FormularioConduta = { tipo: 'orientacao', titulo: '', conteudo: '', validadeInicio: '', validadeFim: '' };

function rotuloTipo(tipo: TipoCondutaTerapeuticaApi) { return tipos.find((item) => item.id === tipo)?.rotulo ?? tipo; }
function formatarData(valor?: string) { return valor ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${valor.slice(0, 10)}T12:00:00Z`)) : undefined; }

export function AbaCondutasTerapeuticas({ pacienteId, podeGerenciar }: { pacienteId: string; podeGerenciar: boolean }) {
  const [condutas, setCondutas] = useState<CondutaTerapeuticaApi[]>([]);
  const [formulario, setFormulario] = useState<FormularioConduta>(formularioInicial);
  const [editando, setEditando] = useState<CondutaTerapeuticaApi | null>(null);
  const [paraArquivar, setParaArquivar] = useState<CondutaTerapeuticaApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try { setCondutas(await listarCondutasTerapeuticas(pacienteId)); }
    catch (erroAtual) { setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível carregar as condutas terapêuticas.')); }
    finally { setCarregando(false); }
  }, [pacienteId]);
  useEffect(() => { void carregar(); }, [carregar]);

  function preencherEdicao(conduta: CondutaTerapeuticaApi) {
    const rascunho = conduta.versoes.find((versao) => versao.estado === 'rascunho');
    if (!rascunho) return;
    setEditando(conduta);
    setFormulario({ tipo: conduta.tipo, titulo: rascunho.titulo, conteudo: rascunho.conteudo, validadeInicio: rascunho.validadeInicio ?? '', validadeFim: rascunho.validadeFim ?? '' });
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault(); setErro(null); setSucesso(null); setSalvando(true);
    try {
      const entrada = { titulo: formulario.titulo.trim(), conteudo: formulario.conteudo.trim(), validadeInicio: formulario.validadeInicio || undefined, validadeFim: formulario.validadeFim || undefined };
      if (editando) await atualizarRascunhoCondutaTerapeutica(pacienteId, editando.id, entrada);
      else await criarCondutaTerapeutica(pacienteId, { ...entrada, tipo: formulario.tipo });
      setFormulario(formularioInicial); setEditando(null); setSucesso(editando ? 'Rascunho atualizado.' : 'Conduta criada como rascunho. Revise antes de publicar.'); await carregar();
    } catch (erroAtual) { setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível salvar a conduta terapêutica.')); }
    finally { setSalvando(false); }
  }

  async function executar(acao: 'publicar' | 'nova-versao' | 'arquivar', conduta: CondutaTerapeuticaApi) {
    setErro(null); setSucesso(null); setSalvando(true);
    try {
      if (acao === 'publicar') await publicarCondutaTerapeutica(pacienteId, conduta.id);
      if (acao === 'nova-versao') await criarNovaVersaoCondutaTerapeutica(pacienteId, conduta.id);
      if (acao === 'arquivar') { await arquivarCondutaTerapeutica(pacienteId, conduta.id); setParaArquivar(null); }
      setSucesso(acao === 'publicar' ? 'Conduta publicada para uso profissional.' : acao === 'nova-versao' ? 'Nova versao em rascunho criada.' : 'Conduta arquivada.');
      await carregar();
    } catch (erroAtual) { setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível atualizar a conduta terapêutica.')); }
    finally { setSalvando(false); }
  }

  if (carregando) return <BarraCarregamento visivel rotulo="Carregando condutas terapeuticas" />;
  return <section className="grid gap-4">
    <div className="flex items-start gap-3 rounded-md border border-linha bg-white p-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primaria-suave text-primaria"><Stethoscope size={19} /></div><div><h2 className="text-base font-semibold text-tinta">Condutas terapeuticas</h2><p className="mt-1 text-sm text-texto-suave">Registre a decisao do profissional, revise o rascunho e publique somente quando estiver pronta. O sistema não sugere dose, produto ou fórmula.</p></div></div>
    {erro ? <AlertaOperacional mensagem={erro} /> : null}{sucesso ? <AlertaSucesso mensagem={sucesso} /> : null}
    {podeGerenciar ? <form onSubmit={salvar} className="grid gap-3 rounded-md border border-linha bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold text-tinta">{editando ? 'Editar rascunho' : 'Nova conduta'}</h3><p className="mt-1 text-sm text-texto-suave">O conteúdo e privado, versionado e mantido fora do portal até uma etapa futura de publicação ao paciente.</p></div>{editando ? <Botao type="button" tamanho="sm" variante="secundario" onClick={() => { setEditando(null); setFormulario(formularioInicial); }}>Cancelar edição</Botao> : null}</div><div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]"><div className="grid gap-1"><Rotulo htmlFor="conduta-tipo">Tipo</Rotulo><select id="conduta-tipo" className="h-10 rounded-md border border-linha bg-white px-3 text-sm" value={formulario.tipo} disabled={Boolean(editando)} onChange={(evento) => setFormulario((atual) => ({ ...atual, tipo: evento.target.value as TipoCondutaTerapeuticaApi }))}>{tipos.map((tipo) => <option key={tipo.id} value={tipo.id}>{tipo.rotulo}</option>)}</select></div><div className="grid gap-1"><Rotulo htmlFor="conduta-titulo">Título</Rotulo><Campo id="conduta-titulo" value={formulario.titulo} onChange={(evento) => setFormulario((atual) => ({ ...atual, titulo: evento.target.value }))} maxLength={180} required /></div></div><div className="grid gap-3 md:grid-cols-2"><div className="grid gap-1"><Rotulo htmlFor="conduta-inicio">Validade inicial</Rotulo><Campo id="conduta-inicio" type="date" value={formulario.validadeInicio} onChange={(evento) => setFormulario((atual) => ({ ...atual, validadeInicio: evento.target.value }))} /></div><div className="grid gap-1"><Rotulo htmlFor="conduta-fim">Validade final</Rotulo><Campo id="conduta-fim" type="date" value={formulario.validadeFim} onChange={(evento) => setFormulario((atual) => ({ ...atual, validadeFim: evento.target.value }))} /></div></div><div className="grid gap-1"><Rotulo htmlFor="conduta-conteudo">Conteúdo documentado</Rotulo><AreaTexto id="conduta-conteudo" value={formulario.conteudo} onChange={(evento) => setFormulario((atual) => ({ ...atual, conteudo: evento.target.value }))} maxLength={6000} required /></div><div className="flex justify-end"><Botao type="submit" variante="primario" carregando={salvando}><FilePenLine size={16} />{editando ? 'Salvar rascunho' : 'Criar rascunho'}</Botao></div></form> : null}
    <div className="grid gap-3"><h3 className="text-sm font-semibold text-tinta">Histórico de condutas</h3>{condutas.length ? condutas.map((conduta) => {
      const atual = conduta.versoes[0]; const rascunho = conduta.versoes.find((versao) => versao.estado === 'rascunho');
      return <article key={conduta.id} className="grid gap-3 rounded-md border border-linha bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-tinta">{atual?.titulo ?? 'Conduta sem versao'}</p><p className="mt-1 text-sm text-texto-suave">{rotuloTipo(conduta.tipo)}{atual ? ` · Versao ${atual.numero} · ${atual.estado}` : ''}</p>{atual?.validadeInicio || atual?.validadeFim ? <p className="mt-1 text-xs text-texto-suave">Validade: {formatarData(atual.validadeInicio) ?? 'sem inicio'} até {formatarData(atual.validadeFim) ?? 'sem fim'}</p> : null}</div>{!conduta.arquivadaEm && podeGerenciar ? <div className="flex flex-wrap gap-2">{rascunho ? <Botao type="button" tamanho="sm" variante="secundario" onClick={() => preencherEdicao(conduta)}><FilePenLine size={15} />Editar</Botao> : <Botao type="button" tamanho="sm" variante="secundario" onClick={() => void executar('nova-versao', conduta)} disabled={salvando}><Plus size={15} />Nova versão</Botao>}{rascunho ? <Botao type="button" tamanho="sm" variante="primario" onClick={() => void executar('publicar', conduta)} disabled={salvando}><Send size={15} />Publicar</Botao> : null}<Botao type="button" tamanho="sm" variante="perigo" onClick={() => setParaArquivar(conduta)}><Archive size={15} />Arquivar</Botao></div> : <span className="text-xs font-medium text-texto-suave">Arquivada</span>}</div>{atual ? <p className="whitespace-pre-wrap text-sm text-texto-suave">{atual.conteudo}</p> : null}<details className="text-sm text-texto-suave"><summary className="cursor-pointer font-medium">Ver versões ({conduta.versoes.length})</summary><ul className="mt-2 grid gap-1">{conduta.versoes.map((versao) => <li key={versao.id}>Versão {versao.numero}: {versao.estado}</li>)}</ul></details></article>;
    }) : <EstadoVazio titulo="Nenhuma conduta registrada" descricao="Crie um rascunho para documentar uma meta, orientação, suplemento, produto ou fórmula manipulada." />}</div>
    <ModalConfirmacao aberto={Boolean(paraArquivar)} titulo="Arquivar conduta terapeutica" mensagem="A conduta deixara de aparecer como ativa, mas seu histórico versionado sera preservado." rotuloConfirmar="Arquivar conduta" confirmando={salvando} aoCancelar={() => setParaArquivar(null)} aoConfirmar={() => { if (paraArquivar) void executar('arquivar', paraArquivar); }} />
  </section>;
}
