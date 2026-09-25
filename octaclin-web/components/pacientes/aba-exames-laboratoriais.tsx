'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { FlaskConical, Plus, Trash2 } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Rotulo } from '@/components/ui/campo';
import { AlertaOperacional, AlertaSucesso, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import { SeletorConsultaRecente } from './seletor-consulta-recente';
import {
  arquivarCatalogoMarcadorExame,
  criarCatalogoMarcadorExame,
  criarColetaExameLaboratorial,
  listarCatalogoMarcadoresExames,
  listarExamesLaboratoriais,
  type CatalogoMarcadorExameApi,
  type ColetaExameLaboratorialApi,
  type CriarMarcadorExameLaboratorialEntrada
} from '@/lib/exames-laboratoriais-api';

interface FormularioColeta {
  coletadaEm: string;
  recebidaEm: string;
  laboratorio: string;
  observacoes: string;
  marcadores: CriarMarcadorExameLaboratorialEntrada[];
  /** PB-24 (Fase 275): consulta de origem, opcional. */
  consultaId: string;
}

function novoMarcador(): CriarMarcadorExameLaboratorialEntrada {
  return { nome: '', valor: '', unidade: '', referencia: '', metodo: '', limiteInferior: '', limiteSuperior: '' };
}

function formularioInicial(): FormularioColeta {
  return {
    coletadaEm: new Date().toISOString().slice(0, 10),
    recebidaEm: '',
    laboratorio: '',
    observacoes: '',
    marcadores: [novoMarcador()],
    consultaId: ''
  };
}

function formatarData(valor: string) {
  const data = new Date(`${valor.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(data.getTime())
    ? valor
    : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'UTC' }).format(data);
}

interface AbaExamesLaboratoriaisProps {
  pacienteId: string;
  podeGerenciar: boolean;
  podeGerenciarCatalogo?: boolean;
}

export function AbaExamesLaboratoriais({ pacienteId, podeGerenciar, podeGerenciarCatalogo = false }: AbaExamesLaboratoriaisProps) {
  const [coletas, setColetas] = useState<ColetaExameLaboratorialApi[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoMarcadorExameApi[]>([]);
  const [totalCatalogo, setTotalCatalogo] = useState(0);
  const [paginaCatalogo, setPaginaCatalogo] = useState(0);
  const [serieSelecionadaId, setSerieSelecionadaId] = useState('');
  const [novoItemCatalogo, setNovoItemCatalogo] = useState({ nome: '', unidade: '', limiteInferior: '', limiteSuperior: '' });
  const [criandoCatalogo, setCriandoCatalogo] = useState(false);
  const [confirmarArquivoId, setConfirmarArquivoId] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<FormularioColeta>(formularioInicial);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const carregarCatalogo = useCallback(async (pagina: number) => {
    try {
      const resposta = await listarCatalogoMarcadoresExames(pagina);
      setCatalogo((atual) => pagina === 1 ? resposta.itens : [...atual, ...resposta.itens]);
      setTotalCatalogo(resposta.total);
      setPaginaCatalogo(pagina);
      setSerieSelecionadaId((atual) => atual || resposta.itens[0]?.id || '');
    } catch (erroAtual) {
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível carregar o catálogo de marcadores.'));
    }
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setColetas(await listarExamesLaboratoriais(pacienteId));
    } catch (erroAtual) {
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível carregar os exames laboratoriais.'));
    } finally {
      setCarregando(false);
    }
  }, [pacienteId]);

  useEffect(() => {
    void carregar();
    void carregarCatalogo(1);
  }, [carregar, carregarCatalogo]);

  function atualizarMarcador(indice: number, chave: keyof CriarMarcadorExameLaboratorialEntrada, valor: string) {
    setFormulario((atual) => ({
      ...atual,
      marcadores: atual.marcadores.map((marcador, marcadorIndice) =>
        marcadorIndice === indice ? {
          ...marcador,
          [chave]: valor,
          ...(chave === 'unidade' && marcador.catalogoMarcadorId
            && valor.trim() !== catalogo.find((item) => item.id === marcador.catalogoMarcadorId)?.unidade
            ? { limiteInferior: '', limiteSuperior: '' } : {})
        } : marcador
      )
    }));
  }

  function selecionarCatalogo(indice: number, catalogoMarcadorId: string) {
    const item = catalogo.find((atual) => atual.id === catalogoMarcadorId);
    setFormulario((atual) => ({
      ...atual,
      marcadores: atual.marcadores.map((marcador, marcadorIndice) => marcadorIndice === indice ? {
        ...marcador,
        catalogoMarcadorId: item?.id,
        nome: item?.nome ?? '',
        unidade: item?.unidade ?? '',
        limiteInferior: item?.limiteInferior ?? '',
        limiteSuperior: item?.limiteSuperior ?? ''
      } : marcador)
    }));
  }

  async function salvarItemCatalogo(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setSucesso(null);
    setCriandoCatalogo(true);
    try {
      await criarCatalogoMarcadorExame({
        nome: novoItemCatalogo.nome.trim(),
        unidade: novoItemCatalogo.unidade.trim() || undefined,
        limiteInferior: novoItemCatalogo.limiteInferior.trim() || undefined,
        limiteSuperior: novoItemCatalogo.limiteSuperior.trim() || undefined
      });
      setNovoItemCatalogo({ nome: '', unidade: '', limiteInferior: '', limiteSuperior: '' });
      setSucesso('Marcador adicionado ao catálogo.');
      await carregarCatalogo(1);
    } catch (erroAtual) {
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível salvar o marcador no catálogo.'));
    } finally {
      setCriandoCatalogo(false);
    }
  }

  async function arquivarItemCatalogo(itemId: string) {
    setErro(null);
    try {
      await arquivarCatalogoMarcadorExame(itemId);
      setConfirmarArquivoId(null);
      setSerieSelecionadaId((atual) => atual === itemId ? '' : atual);
      setSucesso('Marcador arquivado no catálogo. Resultados anteriores foram preservados.');
      await carregarCatalogo(1);
    } catch (erroAtual) {
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível arquivar o marcador.'));
    }
  }

  function adicionarMarcador() {
    setFormulario((atual) => ({ ...atual, marcadores: [...atual.marcadores, novoMarcador()] }));
  }

  function removerMarcador(indice: number) {
    setFormulario((atual) => ({
      ...atual,
      marcadores: atual.marcadores.length === 1 ? atual.marcadores : atual.marcadores.filter((_, itemIndice) => itemIndice !== indice)
    }));
  }

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setSucesso(null);
    const marcadores = formulario.marcadores
      .map((marcador) => ({
        catalogoMarcadorId: marcador.catalogoMarcadorId || undefined,
        nome: marcador.nome.trim(),
        valor: marcador.valor.trim(),
        unidade: marcador.unidade?.trim() || undefined,
        referencia: marcador.referencia?.trim() || undefined,
        metodo: marcador.metodo?.trim() || undefined,
        limiteInferior: marcador.limiteInferior?.trim() || null,
        limiteSuperior: marcador.limiteSuperior?.trim() || null
      }))
      .filter((marcador) => marcador.nome || marcador.valor);

    if (!marcadores.length || marcadores.some((marcador) => !marcador.nome || !marcador.valor)) {
      setErro('Informe nome e valor em cada marcador adicionado.');
      return;
    }
    if (marcadores.some((marcador) => (marcador.limiteInferior || marcador.limiteSuperior) && !marcador.unidade)) {
      setErro('Informe a unidade para comparar o resultado com a faixa.');
      return;
    }

    setSalvando(true);
    try {
      await criarColetaExameLaboratorial(pacienteId, {
        coletadaEm: formulario.coletadaEm,
        recebidaEm: formulario.recebidaEm || undefined,
        laboratorio: formulario.laboratorio.trim() || undefined,
        observacoes: formulario.observacoes.trim() || undefined,
        marcadores,
        consultaId: formulario.consultaId || undefined
      });
      setFormulario(formularioInicial());
      setSucesso('Coleta laboratorial registrada no prontuário.');
      await carregar();
    } catch (erroAtual) {
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível registrar a coleta laboratorial.'));
    } finally {
      setSalvando(false);
    }
  }

  const opcoesSerie = new Map<string, string>();
  for (const item of catalogo) opcoesSerie.set(item.id, item.nome);
  for (const coleta of coletas) {
    for (const marcador of coleta.marcadores) {
      if (marcador.catalogoMarcadorId && !opcoesSerie.has(marcador.catalogoMarcadorId)) {
        opcoesSerie.set(marcador.catalogoMarcadorId, marcador.nome);
      }
    }
  }
  const serieAtivaId = serieSelecionadaId || opcoesSerie.keys().next().value || '';
  const nomeSerie = opcoesSerie.get(serieAtivaId) ?? '';
  const pontosSerie = coletas.flatMap((coleta) => coleta.marcadores
    .filter((marcador) => marcador.catalogoMarcadorId === serieAtivaId)
    .map((marcador) => ({ ...marcador, coletadaEm: coleta.coletadaEm })))
    .sort((a, b) => a.coletadaEm.localeCompare(b.coletadaEm));

  if (carregando) return <BarraCarregamento visivel rotulo="Carregando exames laboratoriais" />;

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-linha bg-white p-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primaria-suave text-primaria">
            <FlaskConical size={19} aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-tinta">Exames laboratoriais</h2>
            <p className="mt-1 text-sm text-texto-suave">Registre coletas e acompanhe os marcadores sem diagnóstico automático.</p>
          </div>
        </div>
        <p className="text-sm text-texto-suave">{coletas.length} {coletas.length === 1 ? 'coleta registrada' : 'coletas registradas'}</p>
      </div>

      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {sucesso ? <AlertaSucesso mensagem={sucesso} /> : null}

      {podeGerenciarCatalogo ? (
        <details className="rounded-md border border-linha bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-tinta">Gerenciar catálogo de marcadores</summary>
          <p className="mt-2 text-sm text-texto-suave">Cadastre padrões da clínica. A faixa pode ser ajustada em cada resultado.</p>
          <form onSubmit={salvarItemCatalogo} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="grid gap-1"><Rotulo htmlFor="catalogo-nome">Nome do marcador</Rotulo><Campo id="catalogo-nome" value={novoItemCatalogo.nome} maxLength={120} minLength={2} required onChange={(evento) => setNovoItemCatalogo((atual) => ({ ...atual, nome: evento.target.value }))} /></div>
            <div className="grid gap-1"><Rotulo htmlFor="catalogo-unidade">Unidade padrão</Rotulo><Campo id="catalogo-unidade" value={novoItemCatalogo.unidade} maxLength={40} onChange={(evento) => setNovoItemCatalogo((atual) => ({ ...atual, unidade: evento.target.value }))} /></div>
            <div className="grid gap-1"><Rotulo htmlFor="catalogo-inferior">Limite inferior padrão</Rotulo><Campo id="catalogo-inferior" inputMode="decimal" value={novoItemCatalogo.limiteInferior} onChange={(evento) => setNovoItemCatalogo((atual) => ({ ...atual, limiteInferior: evento.target.value }))} /></div>
            <div className="grid gap-1"><Rotulo htmlFor="catalogo-superior">Limite superior padrão</Rotulo><Campo id="catalogo-superior" inputMode="decimal" value={novoItemCatalogo.limiteSuperior} onChange={(evento) => setNovoItemCatalogo((atual) => ({ ...atual, limiteSuperior: evento.target.value }))} /></div>
            <div className="md:col-span-2 xl:col-span-4"><Botao type="submit" tamanho="sm" carregando={criandoCatalogo}>Adicionar ao catálogo</Botao></div>
          </form>
          {catalogo.length ? <ul className="mt-4 grid gap-2">
            {catalogo.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-linha p-2 text-sm">
              <span className="text-tinta">{item.nome}{item.unidade ? ` · ${item.unidade}` : ''}</span>
              {confirmarArquivoId === item.id ? <span className="flex items-center gap-2">
                <span>Arquivar este padrão?</span>
                <Botao type="button" tamanho="sm" variante="fantasma" onClick={() => setConfirmarArquivoId(null)}>Cancelar</Botao>
                <Botao type="button" tamanho="sm" onClick={() => void arquivarItemCatalogo(item.id)}>Confirmar arquivo</Botao>
              </span> : <Botao type="button" tamanho="sm" variante="fantasma" onClick={() => setConfirmarArquivoId(item.id)}>Arquivar</Botao>}
            </li>)}
          </ul> : null}
        </details>
      ) : null}

      {podeGerenciar ? (
        <form onSubmit={salvar} className="grid gap-4 rounded-md border border-linha bg-white p-4">
          <div>
            <h3 className="text-sm font-semibold text-tinta">Nova coleta</h3>
            <p className="mt-1 text-sm text-texto-suave">Os resultados ficam restritos ao prontuário e não recebem interpretação pelo sistema.</p>
          </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
             <div className="grid gap-1"><Rotulo htmlFor="coleta-data">Data da coleta</Rotulo><Campo id="coleta-data" type="date" value={formulario.coletadaEm} onChange={(evento) => setFormulario((atual) => ({ ...atual, coletadaEm: evento.target.value }))} required /></div>
             <div className="grid gap-1"><Rotulo htmlFor="coleta-recebimento">Data de recebimento</Rotulo><Campo id="coleta-recebimento" type="date" value={formulario.recebidaEm} onChange={(evento) => setFormulario((atual) => ({ ...atual, recebidaEm: evento.target.value }))} /></div>
             <div className="grid gap-1 md:col-span-2"><Rotulo htmlFor="coleta-laboratorio">Laboratório</Rotulo><Campo id="coleta-laboratorio" value={formulario.laboratorio} maxLength={180} onChange={(evento) => setFormulario((atual) => ({ ...atual, laboratorio: evento.target.value }))} /></div>
          </div>

          <div className="grid gap-3 border-y border-linha py-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold text-tinta">Marcadores</h4><Botao type="button" tamanho="sm" onClick={adicionarMarcador}><Plus size={15} />Adicionar marcador</Botao></div>
            {formulario.marcadores.map((marcador, indice) => (
              <div key={indice} className="grid gap-3 rounded-md border border-linha p-3 md:grid-cols-2 xl:grid-cols-4 xl:items-end">
                <div className="grid gap-1"><Rotulo htmlFor={`marcador-catalogo-${indice}`}>Marcador do catálogo</Rotulo><select id={`marcador-catalogo-${indice}`} className="h-10 rounded-md border border-linha bg-white px-3 text-sm text-tinta" value={marcador.catalogoMarcadorId ?? ''} onChange={(evento) => selecionarCatalogo(indice, evento.target.value)}><option value="">Nome livre</option>{catalogo.map((item) => <option key={item.id} value={item.id}>{item.nome}{item.unidade ? ` (${item.unidade})` : ''}</option>)}</select></div>
                <div className="grid gap-1"><Rotulo htmlFor={`marcador-nome-${indice}`}>Marcador</Rotulo><Campo id={`marcador-nome-${indice}`} value={marcador.nome} maxLength={120} readOnly={!!marcador.catalogoMarcadorId} onChange={(evento) => atualizarMarcador(indice, 'nome', evento.target.value)} required /></div>
                <div className="grid gap-1"><Rotulo htmlFor={`marcador-valor-${indice}`}>Valor</Rotulo><Campo id={`marcador-valor-${indice}`} value={marcador.valor} maxLength={80} onChange={(evento) => atualizarMarcador(indice, 'valor', evento.target.value)} required /></div>
                <div className="grid gap-1"><Rotulo htmlFor={`marcador-unidade-${indice}`}>Unidade</Rotulo><Campo id={`marcador-unidade-${indice}`} value={marcador.unidade ?? ''} maxLength={40} onChange={(evento) => atualizarMarcador(indice, 'unidade', evento.target.value)} /></div>
                <div className="grid gap-1"><Rotulo htmlFor={`marcador-inferior-${indice}`}>Limite inferior</Rotulo><Campo id={`marcador-inferior-${indice}`} inputMode="decimal" value={marcador.limiteInferior ?? ''} onChange={(evento) => atualizarMarcador(indice, 'limiteInferior', evento.target.value)} /></div>
                <div className="grid gap-1"><Rotulo htmlFor={`marcador-superior-${indice}`}>Limite superior</Rotulo><Campo id={`marcador-superior-${indice}`} inputMode="decimal" value={marcador.limiteSuperior ?? ''} onChange={(evento) => atualizarMarcador(indice, 'limiteSuperior', evento.target.value)} /></div>
                <div className="grid gap-1"><Rotulo htmlFor={`marcador-referencia-${indice}`}>Referência</Rotulo><Campo id={`marcador-referencia-${indice}`} value={marcador.referencia ?? ''} maxLength={160} onChange={(evento) => atualizarMarcador(indice, 'referencia', evento.target.value)} /></div>
                <div className="grid gap-1"><Rotulo htmlFor={`marcador-metodo-${indice}`}>Método</Rotulo><Campo id={`marcador-metodo-${indice}`} value={marcador.metodo ?? ''} maxLength={120} onChange={(evento) => atualizarMarcador(indice, 'metodo', evento.target.value)} /></div>
                <Botao type="button" tamanho="sm" variante="fantasma" aria-label={`Remover marcador ${indice + 1}`} onClick={() => removerMarcador(indice)} disabled={formulario.marcadores.length === 1}><Trash2 size={16} /></Botao>
              </div>
            ))}
            {catalogo.length < totalCatalogo ? <Botao type="button" tamanho="sm" variante="fantasma" onClick={() => void carregarCatalogo(paginaCatalogo + 1)}>Carregar mais marcadores do catálogo</Botao> : null}
          </div>

          <div className="grid gap-1"><Rotulo htmlFor="coleta-observacoes">Observações</Rotulo><AreaTexto id="coleta-observacoes" value={formulario.observacoes} maxLength={4000} onChange={(evento) => setFormulario((atual) => ({ ...atual, observacoes: evento.target.value }))} /></div>
          <SeletorConsultaRecente pacienteId={pacienteId} value={formulario.consultaId} onChange={(consultaId) => setFormulario((atual) => ({ ...atual, consultaId }))} disabled={salvando} />
          <div className="flex justify-end"><Botao type="submit" variante="primario" carregando={salvando}><FlaskConical size={16} />Registrar coleta</Botao></div>
        </form>
      ) : null}

      {opcoesSerie.size ? <section className="grid gap-3 rounded-md border border-linha bg-white p-4" aria-label="Série por marcador">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-sm font-semibold text-tinta">Série por marcador</h3><p className="text-sm text-texto-suave">Resultados vinculados ao mesmo marcador, em ordem de coleta.</p></div>
          <div className="grid gap-1"><Rotulo htmlFor="serie-marcador">Marcador da série</Rotulo><select id="serie-marcador" className="h-10 rounded-md border border-linha bg-white px-3 text-sm text-tinta" value={serieAtivaId} onChange={(evento) => setSerieSelecionadaId(evento.target.value)}>{[...opcoesSerie].map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></div>
        </div>
        {pontosSerie.length ? <div className="overflow-x-auto"><table aria-label={`Série de ${nomeSerie}`} className="w-full min-w-[480px] text-left text-sm"><thead className="border-b border-linha text-xs uppercase text-texto-suave"><tr><th className="px-2 py-2">Coleta</th><th className="px-2 py-2">Resultado</th><th className="px-2 py-2">Faixa informada</th></tr></thead><tbody>{pontosSerie.map((ponto) => <tr key={ponto.id} className="border-b border-linha last:border-0"><td className="px-2 py-2">{formatarData(ponto.coletadaEm)}</td><td className="px-2 py-2">{ponto.valor}{ponto.unidade ? ` ${ponto.unidade}` : ''}</td><td className="px-2 py-2">{ponto.limiteInferior ?? '—'} a {ponto.limiteSuperior ?? '—'}{ponto.unidade ? ` ${ponto.unidade}` : ''}{ponto.situacaoFaixa === 'fora_da_faixa' ? ' · Fora da faixa informada' : ''}</td></tr>)}</tbody></table></div> : <p className="text-sm text-texto-suave">Ainda não há resultados vinculados a este marcador.</p>}
      </section> : null}

      <div className="grid gap-3">
        <h3 className="text-sm font-semibold text-tinta">Série laboratorial</h3>
        {coletas.length ? coletas.map((coleta) => (
          <article key={coleta.id} className="grid gap-3 rounded-md border border-linha bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="text-sm font-semibold text-tinta">Coleta de {formatarData(coleta.coletadaEm)}</h4><p className="mt-1 text-sm text-texto-suave">{coleta.laboratorio || 'Laboratório não informado'}{coleta.recebidaEm ? ` · Recebido em ${formatarData(coleta.recebidaEm)}` : ''}</p></div><span className="rounded-md bg-superficie px-2 py-1 text-xs font-medium text-texto-suave">{coleta.marcadores.length} {coleta.marcadores.length === 1 ? 'marcador' : 'marcadores'}</span></div>
            <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-linha text-xs uppercase text-texto-suave"><tr><th className="px-2 py-2 font-semibold">Marcador</th><th className="px-2 py-2 font-semibold">Valor</th><th className="px-2 py-2 font-semibold">Referência</th><th className="px-2 py-2 font-semibold">Método</th></tr></thead><tbody>{coleta.marcadores.map((marcador) => <tr key={marcador.id} className="border-b border-linha last:border-0"><td className="px-2 py-2 font-medium text-tinta">{marcador.nome}</td><td className="px-2 py-2 text-tinta">{marcador.valor}{marcador.unidade ? ` ${marcador.unidade}` : ''}</td><td className="px-2 py-2 text-texto-suave">{marcador.limiteInferior !== undefined || marcador.limiteSuperior !== undefined ? `${marcador.limiteInferior ?? '—'} a ${marcador.limiteSuperior ?? '—'}${marcador.unidade ? ` ${marcador.unidade}` : ''}` : marcador.referencia || '-'}{marcador.situacaoFaixa === 'fora_da_faixa' ? <span className="block font-medium text-perigo">Fora da faixa informada</span> : null}</td><td className="px-2 py-2 text-texto-suave">{marcador.metodo || '-'}</td></tr>)}</tbody></table></div>
            {coleta.observacoes ? <p className="border-t border-linha pt-3 text-sm text-texto-suave">{coleta.observacoes}</p> : null}
          </article>
        )) : <EstadoVazio titulo="Nenhuma coleta registrada" descricao="Registre a primeira coleta para acompanhar a série laboratorial deste paciente." />}
      </div>
    </section>
  );
}
