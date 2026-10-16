'use client';

import { CalendarDays, Printer, Target } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { Etiqueta } from '@/components/ui/etiqueta';
import { TrocasLiberadasItem } from '@/components/portal/trocas-liberadas-item';
import {
  listarPlanosAlimentaresPortalPaciente,
  obterPlanoAlimentarPortalPaciente,
  type PlanoAlimentarPacienteApi,
  type PlanoAlimentarPortalResumoApi
} from '@/lib/portal-api';
import { useEffect, useState } from 'react';

interface PlanoAlimentarPacienteProps {
  plano?: PlanoAlimentarPacienteApi;
  rotuloPreview?: string;
  impressaoSomente?: boolean;
  mostrarBotaoImprimir?: boolean;
  usarLista?: boolean;
  habilitado?: boolean;
}

function formatarNumero(valor: number, casasDecimais = 0) {
  return new Intl.NumberFormat('pt-BR', {
    maximumFractionDigits: casasDecimais,
    minimumFractionDigits: casasDecimais
  }).format(valor);
}

function formatarData(valor: string) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return 'Data de publicacao indisponivel';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(data);
}

function descricaoPorcao(quantidade: number, unidade: string, porcaoGramas: number) {
  const quantidadeFormatada = formatarNumero(quantidade, quantidade % 1 === 0 ? 0 : 1);
  const porcao = porcaoGramas > 0 ? ` (${formatarNumero(porcaoGramas)} g)` : '';
  return `${quantidadeFormatada} ${unidade}${porcao}`;
}

function ConteudoPlanoAlimentarPaciente({
  plano,
  rotuloPreview,
  impressaoSomente = false,
  mostrarBotaoImprimir = true
}: PlanoAlimentarPacienteProps) {
  if (!plano) {
    return (
      <Cartao className="print:hidden">
        <CartaoCabecalho>
          <CartaoTitulo icone={<Target className="h-4 w-4" />}>Plano alimentar</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          <p className="text-sm text-texto-suave">Seu plano alimentar ainda não esta disponível. Quando ele for publicado, aparecera aqui.</p>
        </CartaoConteudo>
      </Cartao>
    );
  }

  if (plano.apresentacaoEstado === 'indisponivel') {
    return (
      <Cartao className="border border-alerta-borda bg-alerta-suave print:hidden">
        <CartaoConteudo>
          <p role="alert" className="text-sm text-alerta-forte">A apresentação deste plano está indisponível. Peça ao profissional responsável para revisar a configuração antes de consultar ou imprimir o conteúdo.</p>
        </CartaoConteudo>
      </Cartao>
    );
  }

  const preferencias = plano.preferenciasApresentacao;
  const compacto = preferencias?.modoCompacto === true;
  const mostrarMedidasCaseiras = preferencias?.medidasCaseiras !== false;
  const metas = preferencias?.macros === false ? [] : [
    plano.metaEnergeticaKcal !== undefined ? { rotulo: 'Energia', valor: `${formatarNumero(plano.metaEnergeticaKcal)} kcal` } : null,
    plano.macros?.carboidratosG !== undefined ? { rotulo: 'Carboidratos', valor: `${formatarNumero(plano.macros.carboidratosG)} g` } : null,
    plano.macros?.proteinasG !== undefined ? { rotulo: 'Proteínas', valor: `${formatarNumero(plano.macros.proteinasG)} g` } : null,
    plano.macros?.gordurasG !== undefined ? { rotulo: 'Gorduras', valor: `${formatarNumero(plano.macros.gordurasG)} g` } : null
  ].filter((meta): meta is { rotulo: string; valor: string } => meta !== null);

  const descreverPorcao = (quantidade: number, unidade: string, porcaoGramas: number) =>
    mostrarMedidasCaseiras ? descricaoPorcao(quantidade, unidade, porcaoGramas) : `${formatarNumero(porcaoGramas)} g`;

  return (
    <Cartao className={`${impressaoSomente ? 'hidden print:block folha-documento' : rotuloPreview ? 'print:hidden' : 'folha-documento'} print:border-0 print:shadow-none`}>
      <CartaoCabecalho className="print:block">
        <div className="min-w-0">
          <CartaoTitulo icone={<Target className="h-4 w-4 print:hidden" />}>{plano.titulo}</CartaoTitulo>
          {rotuloPreview ? <p role="status" className="mt-1 text-xs font-medium text-alerta-forte">{rotuloPreview}</p> : null}
          {plano.publicadoEm ? <p className="mt-1 flex items-center gap-1 text-xs text-texto-suave">
            <CalendarDays className="h-3.5 w-3.5 print:hidden" />Publicado em {formatarData(plano.publicadoEm)}
          </p> : null}
        </div>
        {mostrarBotaoImprimir ? <Botao type="button" variante="secundario" className="print:hidden" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Imprimir ou salvar PDF
        </Botao> : null}
      </CartaoCabecalho>
      <CartaoConteudo className={`${compacto ? 'gap-3' : 'gap-5'} print:gap-4`}>
        {plano.objetivo ? (
          <section aria-labelledby="objetivo-plano-alimentar">
            <h3 id="objetivo-plano-alimentar" className="text-sm font-semibold text-tinta">Objetivo</h3>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-texto-suave">{plano.objetivo}</p>
          </section>
        ) : null}

        {preferencias?.orientacoes !== false && plano.orientacoes ? (
          <section aria-labelledby="orientacoes-plano-alimentar">
            <h3 id="orientacoes-plano-alimentar" className="text-sm font-semibold text-tinta">Orientações gerais</h3>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-texto-suave">{plano.orientacoes}</p>
          </section>
        ) : null}

        {metas.length ? (
          <section aria-labelledby="metas-plano-alimentar">
            <h3 id="metas-plano-alimentar" className="text-sm font-semibold text-tinta">Metas do plano</h3>
            <dl className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {metas.map((meta) => (
                <div key={meta.rotulo} className="border-l-2 border-primaria bg-superficie px-3 py-2">
                  <dt className="text-xs text-texto-suave">{meta.rotulo}</dt>
                  <dd className="mt-1 text-sm font-semibold text-tinta">{meta.valor}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <section aria-labelledby="refeicoes-plano-alimentar" className="grid gap-3">
          <h3 id="refeicoes-plano-alimentar" className="text-sm font-semibold text-tinta">Refeições</h3>
          {plano.refeicoes.length ? (
            plano.refeicoes.map((refeicao) => (
              <article key={refeicao.id} className={`border border-linha bg-superficie ${compacto ? 'p-2' : 'p-3'} print:break-inside-avoid`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-tinta">{refeicao.nome}</h4>
                  {preferencias?.horario !== false && refeicao.horarioLocal ? <Etiqueta>{refeicao.horarioLocal}</Etiqueta> : null}
                </div>
                {preferencias?.orientacoes !== false && refeicao.orientacoes ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-texto-suave">{refeicao.orientacoes}</p> : null}
                <ul className="mt-3 grid gap-3" aria-label={`Itens de ${refeicao.nome}`}>
                  {refeicao.itens.map((item) => (
                    <li key={item.id} className="border-t border-linha pt-3 first:border-t-0 first:pt-0">
                      <p className="break-words text-sm font-medium text-tinta">{item.descricao}</p>
                      <p className="mt-1 text-xs text-texto-suave">{descreverPorcao(item.quantidade, item.unidade, item.porcaoGramas)}</p>
                      <TrocasLiberadasItem
                        key={`${item.id}:${item.escolhaAtualSubstituicaoId ?? 'principal'}:${plano.apresentacaoEstado === 'configurada' ? String(preferencias?.substituicoesExpandidas) : 'legado'}`}
                        item={item}
                        descricaoPorcao={descreverPorcao}
                        substituicoesExpandidas={plano.apresentacaoEstado === 'configurada' ? preferencias?.substituicoesExpandidas : undefined}
                        somenteLeitura={Boolean(rotuloPreview || impressaoSomente)}
                      />
                    </li>
                  ))}
                </ul>
              </article>
            ))
          ) : (
            <p className="text-sm text-texto-suave">Nenhuma refeição foi incluida nesta versão do plano.</p>
          )}
        </section>
      </CartaoConteudo>
    </Cartao>
  );
}

const LIMITE_PLANOS_PORTAL = 10;

export function PlanoAlimentarPaciente({
  plano,
  rotuloPreview,
  impressaoSomente = false,
  mostrarBotaoImprimir = true,
  usarLista = false,
  habilitado = true
}: PlanoAlimentarPacienteProps) {
  const [pagina, setPagina] = useState(1);
  const [paginaPlanos, setPaginaPlanos] = useState<{ itens: PlanoAlimentarPortalResumoApi[]; total: number; chaveConsulta: string } | null>(null);
  const [planoSelecionadoId, setPlanoSelecionadoId] = useState('');
  const [planoSelecionado, setPlanoSelecionado] = useState<{ chave: string; dados: PlanoAlimentarPacienteApi } | null>(null);
  const [erroLista, setErroLista] = useState<{ chave: string; mensagem: string } | null>(null);
  const [atualizacao, setAtualizacao] = useState(0);
  const chaveConsulta = `${usarLista ? 'lista' : 'detalhe'}:${habilitado ? 'habilitado' : 'desabilitado'}:${pagina}:${atualizacao}`;
  const mensagemErroLista = erroLista && (erroLista.chave === chaveConsulta || erroLista.chave === `${chaveConsulta}:${planoSelecionadoId}`)
    ? erroLista.mensagem
    : null;
  const chaveDetalheAtual = `${chaveConsulta}:${planoSelecionadoId}`;
  const detalheAtual = planoSelecionado?.chave === chaveDetalheAtual ? planoSelecionado.dados : null;
  const dadosPaginaAtual = paginaPlanos?.chaveConsulta === chaveConsulta ? paginaPlanos : null;
  const carregandoLista = usarLista && habilitado && !dadosPaginaAtual && !mensagemErroLista;

  useEffect(() => {
    if (!usarLista || !habilitado) return;
    const controller = new AbortController();
    void listarPlanosAlimentaresPortalPaciente({ pagina, limite: LIMITE_PLANOS_PORTAL }, controller.signal)
      .then((resultado) => {
        if (controller.signal.aborted) return;
        const ultimoIndice = Math.max(1, Math.ceil(resultado.total / LIMITE_PLANOS_PORTAL));
        if (!resultado.itens.length && pagina > ultimoIndice) {
          setPagina(ultimoIndice);
          setAtualizacao((valor) => valor + 1);
          return;
        }
        setPaginaPlanos({ itens: resultado.itens, total: resultado.total, chaveConsulta });
        setPlanoSelecionadoId((atual) => resultado.itens.some((item) => item.id === atual) ? atual : resultado.itens[0]?.id ?? '');
        if (!resultado.itens.length) setPlanoSelecionado(null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setErroLista({ chave: chaveConsulta, mensagem: 'Não foi possível carregar seus planos alimentares. Tente novamente.' });
      });
    return () => controller.abort();
  }, [usarLista, habilitado, pagina, atualizacao, chaveConsulta]);

  useEffect(() => {
    if (!usarLista || !habilitado || !planoSelecionadoId) return;
    const controller = new AbortController();
    void obterPlanoAlimentarPortalPaciente(planoSelecionadoId, controller.signal)
      .then((resultado) => {
        if (!controller.signal.aborted && resultado.id === planoSelecionadoId) setPlanoSelecionado({ chave: chaveDetalheAtual, dados: resultado });
      })
      .catch((erro: unknown) => {
        if (controller.signal.aborted) return;
        setPlanoSelecionado(null);
        if (typeof erro === 'object' && erro !== null && 'status' in erro && erro.status === 404) {
          setErroLista({ chave: `${chaveConsulta}:${planoSelecionadoId}`, mensagem: 'Este plano deixou de estar disponível. A lista foi atualizada.' });
          setPlanoSelecionadoId('');
          setAtualizacao((valor) => valor + 1);
        } else {
          setErroLista({ chave: `${chaveConsulta}:${planoSelecionadoId}`, mensagem: 'Não foi possível abrir este plano. Tente novamente.' });
        }
      });
    return () => controller.abort();
  }, [usarLista, habilitado, planoSelecionadoId, chaveConsulta, chaveDetalheAtual]);

  if (!usarLista) return <ConteudoPlanoAlimentarPaciente plano={plano} rotuloPreview={rotuloPreview} impressaoSomente={impressaoSomente} mostrarBotaoImprimir={mostrarBotaoImprimir} />;

  const totalPaginas = Math.max(1, Math.ceil((dadosPaginaAtual?.total ?? 0) / LIMITE_PLANOS_PORTAL));

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 print:hidden" aria-label="Seus planos alimentares">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-tinta">Seus planos alimentares</h2>
            <p className="text-xs text-texto-suave">Planos publicados que estão disponíveis para você.</p>
          </div>
          {dadosPaginaAtual && dadosPaginaAtual.total > LIMITE_PLANOS_PORTAL ? <nav className="flex items-center gap-2" aria-label="Paginação dos planos alimentares">
            <Botao type="button" tamanho="sm" disabled={pagina <= 1 || carregandoLista} onClick={() => { setErroLista(null); setPagina((atual) => Math.max(1, atual - 1)); }}>Anterior</Botao>
            <span role="status" aria-live="polite" className="text-xs text-texto-suave">Página {pagina} de {totalPaginas}</span>
            <Botao type="button" tamanho="sm" disabled={pagina >= totalPaginas || carregandoLista} onClick={() => { setErroLista(null); setPagina((atual) => Math.min(totalPaginas, atual + 1)); }}>Próxima</Botao>
          </nav> : null}
        </div>
        {mensagemErroLista ? <p role="alert" className="rounded-md border border-alerta-borda bg-alerta-suave p-3 text-sm text-alerta-forte">{mensagemErroLista}</p> : null}
        {carregandoLista && !dadosPaginaAtual ? <p role="status" className="text-sm text-texto-suave">Carregando planos disponíveis…</p> : null}
        {dadosPaginaAtual?.itens.length ? <ul className="grid gap-2 sm:grid-cols-2">
          {dadosPaginaAtual.itens.map((item) => <li key={item.id}>
            <button type="button" aria-current={planoSelecionadoId === item.id ? 'true' : undefined}
              onClick={() => { setErroLista(null); setPlanoSelecionadoId(item.id); }}
              className={`min-h-11 w-full rounded-md border p-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria ${planoSelecionadoId === item.id ? 'border-primaria bg-primaria-suave' : 'border-linha bg-white'}`}>
              <span className="block break-words text-sm font-semibold text-tinta">{item.titulo}</span>
              <span className="mt-1 block text-xs text-texto-suave">Versão {item.numeroVersao} · publicado em {formatarData(item.publicadoEm)}</span>
            </button>
          </li>)}
        </ul> : dadosPaginaAtual && !dadosPaginaAtual.itens.length && !carregandoLista && !mensagemErroLista ? <p className="rounded-md border border-linha bg-superficie p-3 text-sm text-texto-suave">Não há planos alimentares disponíveis no momento.</p> : null}
      </section>
      {habilitado && detalheAtual && detalheAtual.id === planoSelecionadoId && dadosPaginaAtual?.itens.some((item) => item.id === planoSelecionadoId)
        ? <ConteudoPlanoAlimentarPaciente plano={detalheAtual} impressaoSomente={impressaoSomente} mostrarBotaoImprimir={mostrarBotaoImprimir} />
        : habilitado && planoSelecionadoId ? <p role="status" className="text-sm text-texto-suave">Carregando o plano selecionado…</p>
          : habilitado ? <ConteudoPlanoAlimentarPaciente plano={undefined} impressaoSomente={impressaoSomente} mostrarBotaoImprimir={false} /> : null}
    </div>
  );
}
