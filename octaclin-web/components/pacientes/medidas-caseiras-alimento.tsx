'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ErroApiPlanoAlimentar,
  atualizarMedidaCaseiraAlimento,
  criarMedidaCaseiraAlimento,
  listarMedidasCaseirasAlimento,
  type MedidaCaseiraAlimentoApi,
  type OrigemBibliotecaAlimentoApi
} from '@/lib/plano-alimentar-api';
import type { MedidaCaseiraAplicadaApi, MedidaCaseiraReferenciaApi } from '@/lib/medidas-caseiras-plano';
import { calcularPesoMedidaCaseira } from '@/lib/medidas-caseiras-plano';
import { mensagemFalhaInterface } from '@/lib/erros-interface';

type Campo = 'nome' | 'quantidadeReferencia' | 'pesoReferenciaGramas';
type Formulario = { nome: string; quantidadeReferencia: string; pesoReferenciaGramas: string; escopo: 'pessoal' | 'clinica' };

const formularioVazio: Formulario = { nome: '', quantidadeReferencia: '1', pesoReferenciaGramas: '', escopo: 'pessoal' };

function numeroValido(valor: string): number | undefined {
  const texto = valor.trim().replace(',', '.');
  if (!/^\d{1,5}(?:\.\d{1,3})?$/.test(texto)) return undefined;
  const numero = Number(texto);
  return Number.isFinite(numero) && numero >= 0.001 && numero <= 10000 ? numero : undefined;
}

interface Props {
  alimentoId?: string | null;
  quantidade: number | string;
  aplicada?: MedidaCaseiraAplicadaApi | null;
  referenciaAplicada?: MedidaCaseiraReferenciaApi;
  podeEditar: boolean;
  origemBiblioteca?: OrigemBibliotecaAlimentoApi;
  aoAplicar: (aplicada: MedidaCaseiraAplicadaApi, referencia: MedidaCaseiraReferenciaApi, unidade: string, gramas: number | '') => void;
}

export function MedidasCaseirasAlimento({ alimentoId, quantidade, aplicada, referenciaAplicada, podeEditar, origemBiblioteca = 'catalogo', aoAplicar }: Props) {
  const montado = useRef(true);
  const [aberto, setAberto] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [itens, setItens] = useState<MedidaCaseiraAlimentoApi[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [formulario, setFormulario] = useState<Formulario>(formularioVazio);
  const [editando, setEditando] = useState<MedidaCaseiraAlimentoApi | null>(null);
  const sequencia = useRef(0);
  const chaveCriacaoPendente = useRef<{ assinatura: string; chave: string } | null>(null);

  useEffect(() => {
    montado.current = true;
    return () => { montado.current = false; };
  }, []);

  async function carregar(proximaPagina = pagina) {
    if (!alimentoId) return;
    const requisicao = ++sequencia.current;
    setCarregando(true);
    setErro('');
    try {
      const resultado = await listarMedidasCaseirasAlimento(alimentoId, proximaPagina, 25, undefined, origemBiblioteca);
      if (sequencia.current !== requisicao || !montado.current) return;
      setItens(resultado.itens);
      setTotal(resultado.total);
      setPagina(resultado.pagina);
    } catch (falha) {
      if (sequencia.current === requisicao && montado.current) {
        setErro(mensagemFalhaInterface(falha, 'Não foi possível carregar as medidas deste alimento.'));
      }
    } finally {
      if (sequencia.current === requisicao && montado.current) setCarregando(false);
    }
  }

  function aplicar(medida: MedidaCaseiraAlimentoApi, referencia = medida) {
    const qtd = numeroValido(String(quantidade));
    let gramas: number | '' = '';
    if (qtd !== undefined) {
      try { gramas = calcularPesoMedidaCaseira(qtd, referencia.pesoReferenciaGramas, referencia.quantidadeReferencia); }
      catch (falha) { setErro(mensagemFalhaInterface(falha, 'A quantidade está fora dos limites para esta medida.')); return; }
    }
    aoAplicar(
      { id: medida.id, revisao: medida.revisao, aplicacaoId: crypto.randomUUID() },
      { nome: referencia.nome, quantidadeReferencia: referencia.quantidadeReferencia, pesoReferenciaGramas: referencia.pesoReferenciaGramas },
      referencia.nome,
      gramas
    );
    setErro('');
    setMensagem(qtd === undefined ? 'Medida vinculada. Complete a quantidade para calcular o peso em gramas.' : 'Medida aplicada ao rascunho; salve o plano para materializar a alteração.');
  }

  function iniciarEdicao(item: MedidaCaseiraAlimentoApi) {
    if (salvando || !podeEditar || !item.podeEditar) return;
    setEditando(item);
    setFormulario({ nome: item.nome, quantidadeReferencia: String(item.quantidadeReferencia), pesoReferenciaGramas: String(item.pesoReferenciaGramas), escopo: item.escopo });
    setErro('');
    setMensagem('');
  }

  async function salvar() {
    if (!alimentoId || !podeEditar || salvando) return;
    const nome = formulario.nome.trim();
    const quantidadeReferencia = numeroValido(formulario.quantidadeReferencia);
    const pesoReferenciaGramas = numeroValido(formulario.pesoReferenciaGramas);
    if (!nome || nome.length > 40 || quantidadeReferencia === undefined || pesoReferenciaGramas === undefined) {
      setErro('Informe nome de até 40 caracteres e valores positivos com até três casas decimais.');
      return;
    }
    setSalvando(true);
    setErro('');
    setMensagem('');
    try {
      if (editando) {
        const atualizada = await atualizarMedidaCaseiraAlimento(alimentoId, editando.id, {
          revisaoEsperada: editando.revisao,
          nome,
          quantidadeReferencia,
          pesoReferenciaGramas
        }, origemBiblioteca);
        if (!montado.current) return;
        setItens((atuais) => atuais.map((item) => item.id === atualizada.id ? atualizada : item));
        setEditando(null);
        setFormulario(formularioVazio);
        setMensagem('Biblioteca atualizada. Os itens já aplicados aos planos continuam com os valores anteriores.');
      } else {
        const assinatura = JSON.stringify([nome, quantidadeReferencia, pesoReferenciaGramas, formulario.escopo]);
        if (chaveCriacaoPendente.current?.assinatura !== assinatura) {
          chaveCriacaoPendente.current = { assinatura, chave: crypto.randomUUID() };
        }
        await criarMedidaCaseiraAlimento(alimentoId, {
          chaveIdempotencia: chaveCriacaoPendente.current.chave, nome, quantidadeReferencia, pesoReferenciaGramas, escopo: formulario.escopo
        }, origemBiblioteca);
        if (!montado.current) return;
        setPagina(1);
        setFormulario(formularioVazio);
        chaveCriacaoPendente.current = null;
        setMensagem('Medida salva na biblioteca. Escolha “Aplicar” para usá-la no rascunho.');
        void carregar(1);
      }
    } catch (falha) {
      if (montado.current && falha instanceof ErroApiPlanoAlimentar && falha.status === 409 && editando) {
        setEditando(null);
        setFormulario(formularioVazio);
        setMensagem('A medida foi alterada em outra operação. A lista será atualizada; confira os dados antes de iniciar outra edição.');
        void carregar(pagina);
      } else if (montado.current) setErro(mensagemFalhaInterface(falha, 'Não foi possível salvar a medida. Atualize a lista e tente novamente.'));
    } finally {
      if (montado.current) setSalvando(false);
    }
  }

  async function desativar(item: MedidaCaseiraAlimentoApi) {
    if (!alimentoId || !podeEditar || !item.podeEditar || !window.confirm(`Desativar “${item.nome}”? Ela deixará de aparecer em novas aplicações; itens existentes permanecem iguais.`)) return;
    setSalvando(true);
    setErro('');
    try {
      const desativada = await atualizarMedidaCaseiraAlimento(alimentoId, item.id, { revisaoEsperada: item.revisao, ativa: false }, origemBiblioteca);
      if (!montado.current) return;
      setItens((atuais) => atuais.filter((atual) => atual.id !== desativada.id));
      setTotal((atual) => Math.max(0, atual - 1));
      setMensagem('Medida desativada. Aplicações existentes foram preservadas.');
    } catch (falha) {
      if (montado.current && falha instanceof ErroApiPlanoAlimentar && falha.status === 409) {
        setMensagem('A medida foi alterada em outra operação. A lista será atualizada; confira os dados antes de tentar novamente.');
        void carregar(pagina);
      } else if (montado.current) setErro(mensagemFalhaInterface(falha, 'A medida mudou desde a última leitura. Atualize a lista antes de tentar novamente.'));
    } finally {
      if (montado.current) setSalvando(false);
    }
  }

  if (!alimentoId) return <p className="text-xs text-texto-suave">Selecione um alimento da biblioteca para usar medidas caseiras. Itens manuais continuam com peso informado diretamente.</p>;
  const paginas = Math.max(1, Math.ceil(total / 25));

  return (
    <section className="grid gap-2 rounded-md border border-linha p-3" aria-label="Medidas caseiras do alimento">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-tinta">Medidas caseiras</h3>
          {aplicada && referenciaAplicada ? <p className="text-xs text-texto-suave">Aplicada: {referenciaAplicada.nome} · {referenciaAplicada.quantidadeReferencia} = {referenciaAplicada.pesoReferenciaGramas} g</p> : <p className="text-xs text-texto-suave">Equivalência explícita em gramas; líquidos também exigem peso informado.</p>}
          {aplicada && !referenciaAplicada ? <p role="status" className="text-xs text-alerta-forte">A referência desta medida não está disponível. Os valores registrados foram preservados; reaplique uma medida ou informe o peso manualmente antes de alterar a quantidade.</p> : null}
        </div>
        <button type="button" className="min-h-11 rounded px-3 text-sm font-semibold text-primaria underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria" aria-expanded={aberto} onClick={() => {
          const proximo = !aberto;
          setAberto(proximo);
          setErro('');
          if (proximo && itens.length === 0) void carregar(1);
          if (!proximo) { sequencia.current += 1; setCarregando(false); }
        }}> {aberto ? 'Fechar medidas' : 'Escolher medida'} </button>
      </div>
      {aberto ? <div className="grid gap-3">
        {carregando ? <p role="status" className="text-sm text-texto-suave">Carregando medidas…</p> : null}
        {erro ? <p role="alert" className="text-sm text-alerta-forte">{erro}</p> : null}
        {mensagem ? <p role="status" className="text-sm text-texto-suave">{mensagem}</p> : null}
        {!carregando && !erro && itens.length === 0 ? <p className="text-sm text-texto-suave">Nenhuma medida ativa para este alimento.</p> : null}
        {itens.length ? <ul className="grid gap-2">{itens.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-linha bg-superficie p-2">
          <div><p className="font-medium text-tinta">{item.nome}</p><p className="text-xs text-texto-suave">{item.quantidadeReferencia} {item.nome} = {item.pesoReferenciaGramas} g · {item.escopo === 'pessoal' ? 'Pessoal' : 'Clínica'}</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="min-h-11 rounded px-3 text-sm font-semibold text-primaria underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria" onClick={() => aplicar(item)}>Aplicar</button>
            {item.podeEditar && podeEditar ? <>
              <button type="button" className="min-h-11 rounded px-3 text-sm text-primaria underline disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria" disabled={salvando} onClick={() => iniciarEdicao(item)}>Editar</button>
              <button type="button" className="min-h-11 rounded px-3 text-sm text-alerta-forte underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria" disabled={salvando} onClick={() => void desativar(item)}>Desativar</button>
            </> : null}
          </div>
        </li>)}</ul> : null}
        {total > 25 ? <nav className="flex items-center justify-between" aria-label="Paginação das medidas caseiras">
          <button type="button" className="min-h-11 px-3 text-sm underline disabled:opacity-50" disabled={pagina <= 1 || carregando} onClick={() => void carregar(pagina - 1)}>Anterior</button>
          <span aria-live="polite" className="text-sm">Página {pagina} de {paginas}</span>
          <button type="button" className="min-h-11 px-3 text-sm underline disabled:opacity-50" disabled={pagina >= paginas || carregando} onClick={() => void carregar(pagina + 1)}>Próxima</button>
        </nav> : null}
        {podeEditar ? <div className="grid gap-2 border-t border-linha pt-3">
          <h4 className="text-sm font-semibold text-tinta">{editando ? `Editar ${editando.nome}` : 'Cadastrar medida'}</h4>
          <label className="grid gap-1 text-xs font-semibold text-texto-suave">Nome da medida
            <input className="min-h-11 rounded border border-linha px-3 text-sm text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria" disabled={salvando} value={formulario.nome} maxLength={40} onChange={(evento) => setFormulario((atual) => ({ ...atual, nome: evento.target.value }))} />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {([['quantidadeReferencia', 'Quantidade de referência'], ['pesoReferenciaGramas', 'Peso de referência (g)']] as const satisfies readonly [Campo, string][]).map(([campo, rotulo]) => <label key={campo} className="grid gap-1 text-xs font-semibold text-texto-suave">{rotulo}
              <input className="min-h-11 rounded border border-linha px-3 text-sm text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria" disabled={salvando} type="text" inputMode="decimal" value={formulario[campo]} onChange={(evento) => setFormulario((atual) => ({ ...atual, [campo]: evento.target.value }))} />
            </label>)}
          </div>
          {!editando ? <label className="grid gap-1 text-xs font-semibold text-texto-suave">Disponibilidade
            <select className="min-h-11 rounded border border-linha px-3 text-sm text-tinta focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria" disabled={salvando || origemBiblioteca === 'custom'} value={origemBiblioteca === 'custom' ? 'pessoal' : formulario.escopo} onChange={(evento) => setFormulario((atual) => ({ ...atual, escopo: evento.target.value as Formulario['escopo'] }))}><option value="pessoal">Pessoal (padrão)</option>{origemBiblioteca === 'catalogo' ? <option value="clinica">Clínica</option> : null}</select>
          </label> : <p className="text-xs text-texto-suave">A disponibilidade da medida não pode ser alterada depois de criada.</p>}
          <div className="flex flex-wrap gap-2">
            <button className="min-h-11 rounded bg-primaria px-4 text-sm font-semibold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria" type="button" onClick={() => void salvar()} disabled={salvando}>{salvando ? 'Salvando…' : editando ? 'Salvar edição' : 'Salvar na biblioteca'}</button>
            {editando ? <button type="button" className="min-h-11 px-3 text-sm underline disabled:opacity-50" disabled={salvando} onClick={() => { setEditando(null); setFormulario(formularioVazio); }}>Cancelar edição</button> : null}
          </div>
        </div> : <p className="text-xs text-texto-suave">Você pode usar medidas pessoais e da clínica; somente quem criou cada medida pode editá-la ou desativá-la.</p>}
      </div> : null}
    </section>
  );
}
