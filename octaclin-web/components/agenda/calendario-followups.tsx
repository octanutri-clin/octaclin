'use client';

import { useEffect, useState } from 'react';
import { obterSessao } from '@/lib/auth-api';
import {
  CalendarioConsultaAgenda, CondicaoFollowupAgenda, EtapaFollowupAgenda,
  obterFollowupsConsulta, obterPadraoFollowupsAgenda, removerFollowupsConsulta,
  salvarFollowupsConsulta, salvarPadraoFollowupsAgenda, simularFollowupsAgenda,
  UnidadeFollowupAgenda
} from '@/lib/agenda-api';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';

const UNIDADES: Array<{ valor: UnidadeFollowupAgenda; rotulo: string }> = [
  { valor: 'mes', rotulo: 'meses antes' }, { valor: 'quinzena', rotulo: 'quinzenas antes' },
  { valor: 'semana', rotulo: 'semanas antes' }, { valor: 'dia', rotulo: 'dias antes' },
  { valor: 'hora', rotulo: 'horas antes' }, { valor: 'minuto', rotulo: 'minutos antes' }
];

function politicaValida(valor: unknown, consulta: boolean): valor is { ativo: boolean; etapas: EtapaFollowupAgenda[]; configurado: boolean; consultasHerdando?: number } {
  if (!valor || typeof valor !== 'object') return false;
  const politica = valor as Record<string, unknown>;
  return typeof politica.ativo === 'boolean' && Array.isArray(politica.etapas) && typeof politica.configurado === 'boolean'
    && (!consulta || (Array.isArray(politica.futuras) && Array.isArray(politica.historico)));
}

function dataFormatada(valor: string, timezone: string) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: timezone, dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor));
}

export function CalendarioFollowups({ consultaId, inicioEm, timezone = 'America/Sao_Paulo' }: { consultaId?: string; inicioEm?: string; timezone?: string }) {
  const [dados, setDados] = useState<{ ativo: boolean; etapas: EtapaFollowupAgenda[]; configurado: boolean; consultasHerdando?: number } | null>(null);
  const [detalhe, setDetalhe] = useState<CalendarioConsultaAgenda | null>(null);
  const [podeEditar, setPodeEditar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [previa, setPrevia] = useState<Array<{ indice: number; envioEm: string; condicao: CondicaoFollowupAgenda }> | null>(null);
  const [frequencia, setFrequencia] = useState<'mensal' | 'quinzenal' | 'semanal' | 'diaria'>('diaria');
  const [quantidade, setQuantidade] = useState(3);
  const [primeira, setPrimeira] = useState(3);

  async function carregar() {
    const resultado = consultaId ? await obterFollowupsConsulta(consultaId) : await obterPadraoFollowupsAgenda();
    if (!politicaValida(resultado, Boolean(consultaId))) throw new Error('Calendario de follow-ups invalido.');
    setDados({ ativo: resultado.ativo, etapas: resultado.etapas, configurado: resultado.configurado, consultasHerdando: resultado.consultasHerdando });
    setDetalhe(consultaId ? resultado as CalendarioConsultaAgenda : null);
    setPrevia(null);
  }

  useEffect(() => {
    let ativo = true;
    Promise.all([consultaId ? obterFollowupsConsulta(consultaId) : obterPadraoFollowupsAgenda(), obterSessao()])
      .then(([resultado, sessao]) => {
        if (!ativo) return;
        if (!politicaValida(resultado, Boolean(consultaId))) throw new Error('Calendario de follow-ups invalido.');
        setDados({ ativo: resultado.ativo, etapas: resultado.etapas, configurado: resultado.configurado, consultasHerdando: resultado.consultasHerdando });
        setDetalhe(consultaId ? resultado as CalendarioConsultaAgenda : null);
        setPodeEditar(Boolean(sessao?.permissoes?.includes('automacoes.gerenciar')));
      })
      .catch(() => { if (ativo) setErro('Não foi possível carregar o calendário de lembretes.'); });
    return () => { ativo = false; };
  }, [consultaId]);

  function atualizar(indice: number, valores: Partial<EtapaFollowupAgenda>) {
    setDados((atual) => atual ? { ...atual, etapas: atual.etapas.map((etapa, posicao) => posicao === indice ? { ...etapa, ...valores } : etapa) } : atual);
    setPrevia(null);
  }

  function gerar() {
    if (!dados || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 30 || !Number.isInteger(primeira) || primeira < quantidade || primeira > 365) {
      setErro('Informe de 1 a 30 envios e uma primeira antecedência igual ou maior que a quantidade.');
      return;
    }
    const unidade = { mensal: 'mes', quinzenal: 'quinzena', semanal: 'semana', diaria: 'dia' }[frequencia] as UnidadeFollowupAgenda;
    setDados({ ...dados, ativo: true, etapas: Array.from({ length: quantidade }, (_, indice) => ({ unidade, valor: primeira - indice, condicao: 'sempre' as const })) });
    setErro(null);
    setPrevia(null);
  }

  async function simular() {
    if (!dados) return;
    setOcupado(true); setErro(null);
    try {
      const exemplo = inicioEm ?? new Date(Date.now() + 45 * 86400000).toISOString();
      setPrevia(dados.ativo ? await simularFollowupsAgenda({ inicioEm: exemplo, timezone, etapas: dados.etapas }) : []);
    } catch { setErro('Revise as etapas: horários iguais ou com menos de 30 minutos de intervalo não são permitidos.'); }
    finally { setOcupado(false); }
  }

  async function salvar() {
    if (!dados) return;
    setOcupado(true); setErro(null); setSucesso(null);
    try {
      const entrada = { ativo: dados.ativo, etapas: dados.etapas };
      if (consultaId) await salvarFollowupsConsulta(consultaId, entrada);
      else await salvarPadraoFollowupsAgenda(entrada);
      await carregar();
      setSucesso('Calendário salvo. As consultas futuras serão reconciliadas em lotes.');
    } catch { setErro('Não foi possível salvar o calendário. Confira a quantidade e os intervalos.'); }
    finally { setOcupado(false); }
  }

  async function herdar() {
    if (!consultaId) return;
    setOcupado(true); setErro(null);
    try { await removerFollowupsConsulta(consultaId); await carregar(); setSucesso('Esta consulta voltou a usar o padrão da clínica.'); }
    catch { setErro('Não foi possível voltar ao padrão da clínica.'); }
    finally { setOcupado(false); }
  }

  return (
    <section className="grid gap-3 rounded-md border border-linha bg-superficie p-4" aria-label={consultaId ? 'Follow-ups desta consulta' : 'Padrão de follow-ups da clínica'}>
      <div>
        <h3 className="font-semibold">{consultaId ? 'Follow-ups desta consulta' : 'Calendário padrão de follow-ups'}</h3>
        <p className="text-sm text-texto-suave">{consultaId ? `Origem: ${detalhe?.origem === 'personalizado' ? 'personalizado' : 'padrão da clínica'}.` : 'Defina quantos avisos serão programados antes de cada consulta.'} Cada etapa usa um canal autorizado pelo paciente. Limite: 30 envios por consulta.</p>
      </div>
      {erro ? <p role="alert" className="text-sm text-red-700">{erro}</p> : null}
      {sucesso ? <p role="status" className="text-sm text-green-700">{sucesso}</p> : null}
      {!dados ? <p className="text-sm">{erro ? 'Calendário indisponível.' : 'Carregando calendário…'}</p> : (
        <>
          <p className="text-sm">{dados.configurado ? `${dados.etapas.length} etapa(s) configurada(s)` : 'Padrão ainda não ativado'}{detalhe ? ` · saldo estimado: ${detalhe.saldo}` : ''}</p>
          {!consultaId && dados.consultasHerdando !== undefined ? <p className="text-sm text-texto-suave">Ao salvar, {dados.consultasHerdando} consulta(s) futura(s) que herdam este padrão serão replanejadas em lotes, sem envios retroativos.</p> : null}
          {podeEditar ? (
            <>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={dados.ativo} onChange={(evento) => setDados({ ...dados, ativo: evento.target.checked })} /> Ativar envios futuros</label>
              <div className="grid gap-2 rounded-md border border-linha p-3 sm:grid-cols-4">
                <label className="grid gap-1"><Rotulo>Cadência</Rotulo><Selecao value={frequencia} onChange={(evento) => setFrequencia(evento.target.value as typeof frequencia)}><option value="diaria">Diária</option><option value="semanal">Semanal</option><option value="quinzenal">Quinzenal</option><option value="mensal">Mensal</option></Selecao></label>
                <label className="grid gap-1"><Rotulo>Quantidade</Rotulo><Campo type="number" min={1} max={30} value={quantidade} onChange={(evento) => setQuantidade(Number(evento.target.value))} /></label>
                <label className="grid gap-1"><Rotulo>Primeira antecedência</Rotulo><Campo type="number" min={1} max={365} value={primeira} onChange={(evento) => setPrimeira(Number(evento.target.value))} /></label>
                <div className="flex items-end"><Botao type="button" onClick={gerar}>Gerar sequência</Botao></div>
              </div>
            </>
          ) : null}
          <ol className="grid gap-2">
            {dados.etapas.map((etapa, indice) => (
              <li key={indice} className="flex flex-wrap items-end gap-2 rounded-md border border-linha p-2 text-sm">
                <span className="pb-2">{indice + 1}.</span>
                <label className="grid gap-1"><Rotulo>Antecedência</Rotulo><Campo aria-label={`Antecedência da etapa ${indice + 1}`} type="number" min={1} max={365} value={etapa.valor} disabled={!podeEditar} onChange={(evento) => atualizar(indice, { valor: Number(evento.target.value) })} /></label>
                <label className="grid gap-1"><Rotulo>Unidade</Rotulo><Selecao aria-label={`Unidade da etapa ${indice + 1}`} value={etapa.unidade} disabled={!podeEditar} onChange={(evento) => atualizar(indice, { unidade: evento.target.value as UnidadeFollowupAgenda, horarioLocal: undefined })}>{UNIDADES.map((item) => <option key={item.valor} value={item.valor}>{item.rotulo}</option>)}</Selecao></label>
                {['mes', 'quinzena', 'semana', 'dia'].includes(etapa.unidade) ? <label className="grid gap-1"><Rotulo>Horário local opcional</Rotulo><Campo aria-label={`Horário da etapa ${indice + 1}`} type="time" value={etapa.horarioLocal ?? ''} disabled={!podeEditar} onChange={(evento) => atualizar(indice, { horarioLocal: evento.target.value || undefined })} /></label> : null}
                <label className="grid gap-1"><Rotulo>Enviar</Rotulo><Selecao aria-label={`Condição da etapa ${indice + 1}`} value={etapa.condicao} disabled={!podeEditar} onChange={(evento) => atualizar(indice, { condicao: evento.target.value as CondicaoFollowupAgenda })}><option value="sempre">Sempre</option><option value="somente_se_nao_confirmada">Só se não confirmada</option></Selecao></label>
                {podeEditar ? <Botao type="button" onClick={() => setDados({ ...dados, etapas: dados.etapas.filter((_, posicao) => posicao !== indice) })}>Remover</Botao> : null}
              </li>
            ))}
          </ol>
          {podeEditar ? <div className="flex flex-wrap gap-2"><Botao type="button" disabled={dados.etapas.length >= 30} onClick={() => setDados({ ...dados, etapas: [...dados.etapas, { unidade: 'dia', valor: 1, condicao: 'sempre' }] })}>Adicionar etapa</Botao><Botao type="button" disabled={ocupado} onClick={() => void simular()}>Simular datas</Botao><Botao type="button" disabled={ocupado} onClick={() => void salvar()}>Salvar calendário</Botao>{consultaId && detalhe?.origem === 'personalizado' ? <Botao type="button" disabled={ocupado} onClick={() => void herdar()}>Voltar ao padrão</Botao> : null}</div> : null}
          {previa ? <div className="text-sm"><p className="font-medium">Prévia no fuso {timezone}</p>{previa.length ? <ul className="list-disc pl-5">{previa.map((item) => <li key={item.indice}>{dataFormatada(item.envioEm, timezone)} · {item.condicao === 'sempre' ? 'sempre' : 'se não confirmada'}</li>)}</ul> : <p>Nenhum envio futuro nesta configuração.</p>}</div> : null}
          {detalhe?.futuras.length ? <div className="text-sm"><p className="font-medium">Agenda salva desta consulta</p><ul className="list-disc pl-5">{detalhe.futuras.map((item) => <li key={item.indice}>{dataFormatada(item.envioEm, timezone)}{item.efetivoEm && item.efetivoEm !== item.envioEm ? ` → ${dataFormatada(item.efetivoEm, timezone)} pela janela do paciente` : ''} · {item.elegivel ? 'previsto' : item.motivo ?? 'não elegível'}</li>)}</ul><p className="text-texto-suave">Preferências, confirmação e disponibilidade do canal são conferidas novamente na hora do envio.</p></div> : null}
          {detalhe?.historico.length ? <div className="text-sm"><p className="font-medium">Histórico desta consulta</p><ul className="list-disc pl-5">{detalhe.historico.map((item) => <li key={item.id}>{dataFormatada(item.envioEm, timezone)} · {item.status}{item.motivo ? ` (${item.motivo})` : ''}</li>)}</ul></div> : null}
        </>
      )}
    </section>
  );
}
