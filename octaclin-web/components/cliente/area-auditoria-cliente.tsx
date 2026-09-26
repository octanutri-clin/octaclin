'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AuditoriaClienteApi, FiltrosAuditoriaClienteApi, obterAuditoriaCliente } from '@/lib/cliente-api';

const campo = 'min-h-10 w-full rounded-md border border-linha bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria';
const botao = 'min-h-10 rounded-md border border-linha bg-white px-4 text-sm font-medium text-texto-forte focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria disabled:opacity-50';

export function AreaAuditoriaCliente() {
  const [filtros, setFiltros] = useState<FiltrosAuditoriaClienteApi>({ pagina: 1 });
  const [dados, setDados] = useState<AuditoriaClienteApi | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const controlador = new AbortController();
    void obterAuditoriaCliente(filtros, controlador.signal)
      .then((resposta) => { if (!controlador.signal.aborted) setDados(resposta); })
      .catch(() => { if (!controlador.signal.aborted) setErro('Não foi possível consultar a auditoria. Confira os filtros e tente novamente.'); })
      .finally(() => { if (!controlador.signal.aborted) setCarregando(false); });
    return () => controlador.abort();
  }, [filtros]);

  function consultar(proximos: FiltrosAuditoriaClienteApi) {
    setDados(null);
    setErro(null);
    setCarregando(true);
    setFiltros(proximos);
  }

  function filtrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    const texto = (chave: string) => String(formulario.get(chave) ?? '').trim();
    const inicio = texto('inicio');
    const fim = texto('fim');
    if (inicio && fim && inicio > fim) {
      setErro('A data inicial deve ser anterior ou igual à data final.');
      return;
    }
    consultar({ pagina: 1, inicio, fim, usuarioId: texto('usuarioId'), acao: texto('acao'), recursoTipo: texto('recursoTipo') });
  }

  return (
    <section id="conta-cliente-auditoria-painel" role="tabpanel" aria-labelledby="conta-cliente-auditoria-aba" className="grid gap-5" aria-busy={carregando}>
      <div className="rounded-lg border border-linha bg-white p-5">
        <h2 className="text-xl font-semibold text-texto-forte">Auditoria da clínica</h2>
        <p className="mt-2 text-sm text-texto-suave">Consulte as ações registradas na sua clínica, da mais recente para a mais antiga. Conteúdo clínico e detalhes internos ficam protegidos.</p>
        <p id="auditoria-ajuda" className="mt-2 text-xs text-texto-suave">Datas e horários em UTC. Os filtros de usuário, ação e tipo de recurso usam correspondência exata. Usuários são identificados pelo código da conta; ações de sistema ou de usuários indisponíveis não exibem esse código.</p>
        <form onSubmit={filtrar} aria-describedby="auditoria-ajuda" className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="grid gap-1 text-sm">Data inicial<input type="date" name="inicio" className={campo} /></label>
          <label className="grid gap-1 text-sm">Data final<input type="date" name="fim" className={campo} /></label>
          <label className="grid gap-1 text-sm">Identificador do usuário<input name="usuarioId" maxLength={36} autoComplete="off" className={campo} /></label>
          <label className="grid gap-1 text-sm">Ação<input name="acao" maxLength={120} placeholder="Ex.: pacientes.criar" autoComplete="off" className={campo} /></label>
          <label className="grid gap-1 text-sm">Tipo de recurso<input name="recursoTipo" maxLength={120} placeholder="Ex.: paciente" autoComplete="off" className={campo} /></label>
          <div className="flex items-end gap-2">
            <button type="submit" disabled={carregando} className={botao}>Filtrar</button>
            <button type="button" disabled={carregando} onClick={(evento) => { evento.currentTarget.form?.reset(); consultar({ pagina: 1 }); }} className={botao}>Limpar filtros</button>
          </div>
        </form>
      </div>

      {erro ? <div role="alert" className="rounded-md border border-perigo-borda bg-white p-4 text-sm text-perigo">
        <p>{erro}</p><button type="button" onClick={() => consultar({ ...filtros })} className={`${botao} mt-3`}>Tentar novamente</button>
      </div> : null}
      {carregando ? <p role="status" className="text-sm text-texto-suave">Carregando auditoria…</p> : null}
      {dados ? <div className="rounded-lg border border-linha bg-white p-5">
        {!dados.itens.length ? <p role="status" className="text-sm text-texto-suave">Nenhum registro encontrado para os filtros selecionados.</p> : (
          <ul aria-label="Registros de auditoria" className="divide-y divide-linha">
            {dados.itens.map((item, indice) => <li key={`${item.criadoEm}-${indice}`} className="grid gap-2 py-4 first:pt-0 sm:grid-cols-2">
              <div><time dateTime={item.criadoEm} className="text-sm font-semibold text-texto-forte">{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'UTC' }).format(new Date(item.criadoEm))} UTC</time>
                <p className="mt-1 break-all text-sm text-texto-forte">{item.acao}</p></div>
              <dl className="grid gap-1 text-xs text-texto-suave">
                <div><dt className="inline font-medium">Usuário: </dt><dd className="inline break-all">{item.usuarioId ?? 'Sistema ou usuário indisponível'}</dd></div>
                <div><dt className="inline font-medium">Tipo de recurso: </dt><dd className="inline break-all">{item.recursoTipo ?? 'Não informado'}</dd></div>
              </dl>
            </li>)}
          </ul>
        )}
        <nav aria-label="Paginação da auditoria" className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-linha pt-4">
          <button type="button" disabled={dados.pagina <= 1} onClick={() => consultar({ ...filtros, pagina: dados.pagina - 1 })} className={botao}>Anterior</button>
          <span className="text-sm text-texto-suave">Página {dados.pagina}</span>
          <button type="button" disabled={!dados.temMais || dados.pagina >= 10000} onClick={() => consultar({ ...filtros, pagina: dados.pagina + 1 })} className={botao}>Próxima</button>
        </nav>
      </div> : null}
    </section>
  );
}
