'use client';
import { FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { GraficoEvolucao } from '@/components/ui/grafico-evolucao';
import { listarPediatria, ContextoPediatricoApi, PaginaPediatricaApi } from '@/lib/antropometria-pediatrica-api';

const rotulos = { imc_idade: 'IMC para idade', estatura_idade: 'Comprimento/estatura para idade', peso_idade: 'Peso para idade', peso_estatura: 'Peso para comprimento/estatura' };
export function AcompanhamentoPediatrico({ pacienteId, podeGerenciar, dataNascimento }: { pacienteId: string; podeGerenciar: boolean; dataNascimento?: string }) {
  const prefixo = useId();
  const [pagina, setPagina] = useState<PaginaPediatricaApi>();
  const [itens, setItens] = useState<PaginaPediatricaApi['itens']>([]);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(true);
  const [pendente, setPendente] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [metrica,setMetrica] = useState<'pesoKg'|'alturaCm'>('pesoKg');
  const controlador = useRef<AbortController | null>(null);
  const pedido = useRef<unknown>(null);
  const vivo = useRef(true);
  const carregar = useCallback(async (cursor?: string) => {
    controlador.current?.abort();
    const atual = new AbortController(); controlador.current = atual;
    try {
      const p = await listarPediatria(pacienteId,cursor,atual.signal);
      if (!atual.signal.aborted) { setPagina(p); setItens(anteriores => cursor ? [...anteriores,...p.itens.filter(i => !anteriores.some(a => a.id === i.id))] : p.itens); }
    } catch { if (!atual.signal.aborted) { setItens([]); setPagina(undefined); setErro('Não foi possível carregar o acompanhamento. Tente novamente.'); } }
    finally { if (!atual.signal.aborted) setOcupado(false); }
  },[pacienteId]);
  useEffect(() => {
    vivo.current = true;
    const inicial = new AbortController(); controlador.current = inicial;
    void listarPediatria(pacienteId,undefined,inicial.signal).then(p => {
      if (!inicial.signal.aborted) { setPagina(p); setItens(p.itens); }
    }).catch(() => {
      if (!inicial.signal.aborted) { setItens([]); setPagina(undefined); setErro('Não foi possível carregar o acompanhamento. Tente novamente.'); }
    }).finally(() => { if (!inicial.signal.aborted) setOcupado(false); });
    return () => { vivo.current = false; controlador.current?.abort(); };
  },[pacienteId]);
  const series = useMemo(() => {
    const grupos = new Map<string, typeof itens>();
    for (const item of itens) {
      const c = item.snapshot.contexto;
      const chave = JSON.stringify([item.snapshot.versao,c.nascimento,c.sexoCurva,c.tecnica,c.nascimentoTipo,c.semanasNascimento,c.diasNascimento,c.origemGestacional,c.tipoMedida,c.edema]);
      grupos.set(chave,[...(grupos.get(chave) ?? []),item]);
    }
    return [...grupos.values()];
  },[itens]);
  async function enviar(corpo: unknown) {
    setOcupado(true); setErro(''); setMensagem('');
    try {
      const resposta = await fetch(`/api/pacientes/${encodeURIComponent(pacienteId)}/avaliacoes-antropometricas`, { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
      if (!resposta.ok) {
        if ([400,403,404,409,422].includes(resposta.status)) {
          if (!vivo.current) return;
          pedido.current = null; setPendente(false);
          if ([403,404].includes(resposta.status)) { setItens([]); setPagina(undefined); }
          setErro(resposta.status === 409 ? 'Confira o cadastro e o contexto antes de confirmar um novo pedido.' : 'Registro recusado. Confira as medidas, o contexto e sua autorização.');
          return;
        }
        throw new Error('registro_nao_confirmado');
      }
      if (!vivo.current) return;
      pedido.current = null; setPendente(false); setMensagem('Avaliação registrada. Medidas preservadas; protocolos aguardam validação.');
      await carregar();
    } catch { if (vivo.current) setErro('Registro não confirmado. Reenvie o mesmo pedido para consultar ou concluir sem duplicar.'); }
    finally { if (vivo.current) setOcupado(false); }
  }
  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (pedido.current) { void enviar(pedido.current); return; }
    const f = new FormData(evento.currentTarget);
    const texto = (nome: string) => String(f.get(nome) ?? '');
    const numero = (nome: string) => texto(nome) === '' ? undefined : Number(texto(nome));
    const pediatrico: ContextoPediatricoApi = {
      confirmado: true, nascimento: texto('nascimento') || undefined,
      sexoCurva: texto('sexoCurva') as ContextoPediatricoApi['sexoCurva'], tecnica: texto('tecnica') as ContextoPediatricoApi['tecnica'], edema: texto('edema') as ContextoPediatricoApi['edema'], nascimentoTipo: texto('nascimentoTipo') as ContextoPediatricoApi['nascimentoTipo'], tipoMedida: texto('tipoMedida') as ContextoPediatricoApi['tipoMedida'], semanasNascimento: numero('semanasNascimento'), diasNascimento: numero('diasNascimento'), origemGestacional: texto('origemGestacional') as ContextoPediatricoApi['origemGestacional']
    };
    pedido.current = { chaveCriacao: crypto.randomUUID(), avaliadaEm: texto('avaliadaEm'), pesoKg: numero('pesoKg'), alturaCm: numero('alturaCm'), pediatrico, protocolo: 'nenhum' };
    setPendente(true);
    void enviar(pedido.current);
  }
  const campo = (nome: string, titulo: string, tipo = 'text', padrao?: string, step?: string) => <div key={nome}><Rotulo htmlFor={`${prefixo}-${nome}`}>{titulo}</Rotulo><Campo id={`${prefixo}-${nome}`} name={nome} type={tipo} defaultValue={padrao} step={step} required={nome === 'avaliadaEm'} min={tipo === 'number' ? '0' : undefined}/></div>;
  const selecao = (nome: string, titulo: string, opcoes: Array<[string,string]>) => <div key={nome}><Rotulo htmlFor={`${prefixo}-${nome}`}>{titulo}</Rotulo><Selecao id={`${prefixo}-${nome}`} name={nome}>{opcoes.map(([valor,rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}</Selecao></div>;
  return <Cartao>
    <CartaoCabecalho><CartaoTitulo>Acompanhamento pediátrico</CartaoTitulo></CartaoCabecalho>
    <CartaoConteudo className="space-y-4">
      <p>Medidas e contexto preservados por avaliação. OMS 2006/2007, SISVAN e INTERGROWTH são referências propostas: nenhuma classificação, escore Z ou percentil está habilitado.</p>
      <p>Idade cronológica em dias civis; idade pós-menstrual e corrigida são relações aritméticas do contexto confirmado, sem aplicação de política clínica. Não há compartilhamento pediátrico no portal.</p>
      {erro && <p role="alert">{erro}</p>}{mensagem && <p role="status">{mensagem}</p>}
      {podeGerenciar && <details><summary className="cursor-pointer py-2 focus-visible:outline">Registrar avaliação pediátrica</summary>
        <form onSubmit={salvar} onChange={e => { if (e.target.getAttribute('name') !== 'confirmacao') { const c = e.currentTarget.elements.namedItem('confirmacao') as HTMLInputElement | null; if (c) c.checked = false; } }} className="space-y-3"><fieldset disabled={ocupado || pendente} className="grid gap-3 sm:grid-cols-2">
          {campo('avaliadaEm','Data da avaliação','date')}{campo('nascimento','Nascimento conferido','date',dataNascimento)}
          {campo('pesoKg','Peso original (kg)','number',undefined,'0.001')}{campo('alturaCm','Comprimento/estatura original (cm)','number',undefined,'0.1')}
          {selecao('sexoCurva','Referência por sexo',[['nao_informado','Não informada'],['masculino','Masculina'],['feminino','Feminina']])}
          {selecao('tecnica','Técnica original',[['nao_informada','Não informada'],['deitado','Deitado'],['em_pe','Em pé']])}
          {selecao('edema','Edema avaliado',[['desconhecido','Desconhecido'],['nao','Não'],['sim','Sim']])}
          {selecao('nascimentoTipo','Contexto de nascimento',[['nao_informado','Não informado'],['a_termo','A termo'],['prematuro','Prematuro']])}
          {campo('semanasNascimento','Semanas gestacionais ao nascer','number',undefined,'1')}{campo('diasNascimento','Dias gestacionais adicionais (0–6)','number',undefined,'1')}
          {selecao('origemGestacional','Origem da idade gestacional',[['nao_informada','Não informada'],['documentada','Documentada'],['informada','Informada']])}
          {selecao('tipoMedida','Momento da medida',[['nao_informado','Não informado'],['nascimento','Ao nascimento'],['pos_natal','Acompanhamento pós-natal']])}
          <label className="flex gap-2 sm:col-span-2"><input name="confirmacao" type="checkbox" required/>Conferi o contexto desta avaliação e entendo que os protocolos clínicos estão bloqueados.</label>
        </fieldset><Botao type="submit" disabled={ocupado}>{pendente ? 'Reenviar o mesmo pedido' : 'Confirmar registro'}</Botao></form>
      </details>}
      <label className="block">Medida no gráfico<Selecao value={metrica} onChange={e => setMetrica(e.target.value as typeof metrica)}><option value="pesoKg">Peso (kg)</option><option value="alturaCm">Comprimento/estatura (cm)</option></Selecao></label>
      <p>Séries separadas quando o contexto ou a técnica mudam. Evolução descritiva das medidas originais, sem curvas ou alertas clínicos.</p>
      {series.map((serie,n) => <GraficoEvolucao key={n} rotulo={`Série ${n+1} — ${metrica === 'pesoKg' ? 'peso' : 'comprimento/estatura'}`} unidade={metrica === 'pesoKg' ? 'kg' : 'cm'} casas={metrica === 'pesoKg' ? 3 : 1} pontos={serie.flatMap(i => i.snapshot.medidas[metrica] === undefined ? [] : [{ data: i.snapshot.avaliadaEm, valor: i.snapshot.medidas[metrica]! }])}/>)}
      {!itens.length && !ocupado && <p>Nenhuma avaliação pediátrica nesta cobertura do histórico.</p>}
      <div tabIndex={0} role="region" aria-label="Tabela pediátrica com rolagem horizontal" className="max-w-full overflow-x-auto focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria"><table className="w-full text-left text-sm"><caption>Histórico das medidas originais e contexto preservado</caption><thead><tr>{['Data','Peso (kg)','Comprimento/estatura (cm)','Idade (dias)','PMA (dias)','Corrigida (dias)','Técnica','Indicadores'].map(t => <th scope="col" key={t} className="p-2">{t}</th>)}</tr></thead><tbody>{itens.map(({id,snapshot:s}) => <tr key={id}>{[s.avaliadaEm,s.medidas.pesoKg ?? 'Ausente',s.medidas.alturaCm ?? 'Ausente',s.idade?.dias ?? 'Não informada',s.idadePosMenstrualDias ?? 'Não informada',s.idadeCorrigidaDias ?? 'Não informada',s.contexto.tecnica === 'em_pe' ? 'Em pé' : s.contexto.tecnica === 'deitado' ? 'Deitado' : 'Não informada'].map((v,n) => <td key={n} className="p-2">{v}</td>)}<td className="p-2">{s.indicadores.map(i => <div key={i.indicador}>{rotulos[i.indicador]}: {i.motivo === 'medida_ausente' ? 'medida ausente' : 'protocolo não ratificado'}</div>)}<details><summary>Contexto e versão</summary><p>Nascimento: {s.contexto.nascimento ?? 'Não informado'}; curva: {s.contexto.sexoCurva}; edema: {s.contexto.edema}; registro: {s.contexto.tipoMedida}; versão: {s.versao}.</p></details></td></tr>)}</tbody></table></div>
      <p aria-live="polite">Última página: {pagina?.registrosExaminados ?? 0} registros examinados; {pagina?.itensExibidos ?? 0} pediátricos exibidos. {pagina?.temMaisHistorico ? 'Há mais histórico a consultar.' : 'Fim da cobertura consultada.'}</p>
      <Botao variante="secundario" disabled={ocupado} onClick={() => { setOcupado(true); setErro(''); void carregar(); }}>Atualizar histórico</Botao>
      {pagina?.proximoCursor && <Botao disabled={ocupado} onClick={() => { setOcupado(true); setErro(''); void carregar(pagina.proximoCursor); }}>Consultar mais histórico</Botao>}
    </CartaoConteudo>
  </Cartao>;
}
