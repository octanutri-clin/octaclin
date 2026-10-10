'use client';

import { useCallback, useEffect, useState } from 'react';
import { Database, RefreshCcw } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { obterDisponibilidadeCatalogosAlimentares, DisponibilidadeCatalogoAlimentarApi } from '@/lib/onboarding-operacoes-api';

function dataCurta(valor?: string | null) {
  if (!valor) return 'Data não informada';
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? 'Data inválida' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

export function DisponibilidadeCatalogosAlimentares({ ativa }: { ativa: boolean }) {
  const [resultado, setResultado] = useState<DisponibilidadeCatalogoAlimentarApi | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (signal?: AbortSignal) => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await obterDisponibilidadeCatalogosAlimentares(signal);
      if (!signal?.aborted) setResultado(dados);
    } catch (erroAtual) {
      if (!signal?.aborted) setErro(erroAtual instanceof Error ? erroAtual.message : 'Não foi possível verificar os catálogos.');
    } finally {
      if (!signal?.aborted) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!ativa) return;
    const controlador = new AbortController();
    queueMicrotask(() => { if (!controlador.signal.aborted) void carregar(controlador.signal); });
    return () => controlador.abort();
  }, [ativa, carregar]);

  return (
    <Cartao>
      <CartaoCabecalho>
        <div>
          <CartaoTitulo icone={<Database className="h-4 w-4" />}>Catálogos alimentares deste ambiente</CartaoTitulo>
          <p className="mt-1 text-xs text-texto-suave">Consulta somente leitura. As pendências não impedem a instalação do kit.</p>
        </div>
        <Botao type="button" tamanho="sm" onClick={() => void carregar()} disabled={carregando}>
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />Verificar
        </Botao>
      </CartaoCabecalho>
      <CartaoConteudo className="grid gap-3" aria-live="polite">
        {carregando ? <p role="status" className="text-sm text-texto-suave">Verificando catálogos…</p> : null}
        {erro ? <p role="alert" className="rounded-md border border-perigo-borda bg-perigo-suave p-3 text-sm text-perigo">Não foi possível verificar. {erro}</p> : null}
        {resultado ? <>
          <p className="text-xs text-texto-suave">Verificado neste ambiente em {dataCurta(resultado.verificadoEm)}. Isso mostra o estado registrado pelo backend.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {resultado.itens.map((base) => (
              <article key={`${base.codigo}:${base.baseCodigo}`} className="grid gap-2 rounded-lg border border-linha bg-superficie p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold">{base.rotulo}</h3>
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${base.estado === 'disponivel' ? 'bg-sucesso-suave text-sucesso-forte' : base.estado === 'ausente' ? 'bg-alerta-suave text-texto-forte' : 'bg-perigo-suave text-perigo'}`}>
                    {base.estado === 'disponivel' ? 'Disponível' : base.estado === 'ausente' ? 'Fonte ausente' : 'Indisponível'}
                  </span>
                </div>
                <p className="text-xs text-texto-suave">Base {base.baseCodigo} · {base.totalEdicoes} edições{base.edicoesLimitadas ? ' · mostrando 10 mais recentes' : ''}</p>
                {base.edicoes.map((edicao, indice) => (
                  <div key={`${edicao.versao ?? 'sem-versao'}-${indice}`} className="border-t border-linha pt-2 text-xs">
                    <p className="font-medium">Versão {edicao.versao ?? 'não identificada'} · {edicao.disponivel ? 'utilizável' : 'pendente'}</p>
                    <p className="mt-1 text-texto-suave">Importada {dataCurta(edicao.importadaEm)} · {edicao.alimentosUtilizaveis}/{edicao.totalDeclarado ?? 0} utilizáveis</p>
                    {edicao.motivos.length ? <p className="mt-1 text-texto-suave">Pendências: {edicao.motivos.map((motivo) => motivo.replaceAll('_', ' ')).join(', ')}</p> : null}
                  </div>
                ))}
                {base.ultimaTentativa ? <p className="border-t border-linha pt-2 text-xs text-alerta-forte">Última tentativa: {base.ultimaTentativa.status.replaceAll('_', ' ')} em {dataCurta(base.ultimaTentativa.iniciadaEm)}. Isso não altera a disponibilidade de edições anteriores.</p> : null}
              </article>
            ))}
          </div>
        </> : null}
      </CartaoConteudo>
    </Cartao>
  );
}
