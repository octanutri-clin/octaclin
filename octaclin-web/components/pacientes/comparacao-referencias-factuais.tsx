'use client';
import { useId, useState } from 'react';
import {
  situacaoRespostas, resumirComparacao, MOTIVOS_COMPARACAO_FACTUAL,
  type ReferenciaNutrienteFactual, type ReferenciasFactuais, type RespostasPacienteReferencias
} from '@/lib/referencias-dieteticas-factuais';
import {
  AVISO_CONTEXTO_TITULO, AVISO_FORA_DO_ESCOPO, COMO_LER, COMO_LER_TITULO, MOTIVO_COMPARACAO_CURTO, MOTIVO_COMPARACAO_LONGO, MOTIVO_CONTEXTO_TEXTO,
  PENDENCIA_TEXTO, textoFonteReferencias, textoReferencia, textoRespostasAtivas, textoResumoComparacao, textoUl
} from '@/lib/textos-referencias-dieteticas';

const CAMPO = 'min-h-11 min-w-0 rounded border border-linha bg-white px-2';
const BOTAO = 'min-h-11 text-left text-primaria underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primaria disabled:text-texto-suave';
const SIM_NAO = [['nao_informada', 'Selecione'], ['nao', 'Não'], ['sim', 'Sim']] as const;

export interface PropsComparacaoReferencias {
  respostas: RespostasPacienteReferencias;
  diaCompleto: boolean;
  ativa: boolean;
  /** A comparação estava ativa e a seleção mudou: só o "dia completo" precisa ser confirmado de novo. */
  selecaoMudou: boolean;
  desabilitado: boolean;
  aoMudarRespostas: (r: RespostasPacienteReferencias) => void;
  aoMudarDiaCompleto: (v: boolean) => void;
  aoAplicar: () => void;
  aoDesativar: () => void;
}

/** Bloco opcional acima da tabela. As respostas ficam só na memória da tela; nada é salvo nem altera o cadastro. */
export function ComparacaoReferencias(p: PropsComparacaoReferencias) {
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const situacao = situacaoRespostas(p.respostas, p.diaCompleto);
  const formVisivel = aberto || p.selecaoMudou;
  const r = p.respostas;
  const mudar = (parte: Partial<RespostasPacienteReferencias>) => { setAberto(true); p.aoMudarRespostas({ ...r, ...parte }); };
  const pendencias = situacao.pendencias.map(x => PENDENCIA_TEXTO[x]).join(', ');
  return <section aria-label="Comparação com referências DRI" className="grid min-w-0 gap-2 rounded border border-linha p-3">
    <h3 className="font-semibold">Comparar com referências DRI</h3>
    <p className="text-sm text-texto-suave">Opcional. Compara o total planejado do dia com valores de referência (DRI, adultos de 19 anos ou mais). As respostas valem só nesta tela e não alteram o cadastro do paciente.</p>
    {p.ativa ? <p role="status" className="text-sm font-medium" data-referencias-ativas="true">Referências DRI ativas: {textoRespostasAtivas(r)}. Dia completo confirmado.</p> : null}
    {p.selecaoMudou && !p.ativa ? <p role="status" className="text-sm">A seleção mudou. Confirme de novo que as refeições formam o dia completo para comparar.</p> : null}
    <div className="flex flex-wrap gap-x-4">
      <button type="button" className={BOTAO} aria-expanded={formVisivel} aria-controls={id} onClick={() => setAberto(!formVisivel)}>
        {formVisivel ? 'Fechar respostas' : p.ativa ? 'Alterar respostas' : 'Comparar com referências'}
      </button>
      {p.ativa ? <button type="button" className={BOTAO} onClick={() => { setAberto(false); p.aoDesativar(); }}>Desativar comparação</button> : null}
    </div>
    <div id={id} hidden={!formVisivel}>
      {formVisivel ? <fieldset disabled={p.desabilitado} className="grid gap-2">
        <legend className="sr-only">Respostas para a comparação com referências</legend>
        {(['gestacao', 'lactacao'] as const).map(campo => <label key={campo} className="grid gap-1 text-sm">{campo === 'gestacao' ? 'Gestação' : 'Lactação'}
          <select className={CAMPO} value={r[campo]} onChange={e => mudar({ [campo]: e.target.value } as Partial<RespostasPacienteReferencias>)}>
            {SIM_NAO.map(([v, rotulo]) => <option key={v} value={v}>{rotulo}</option>)}
          </select></label>)}
        {situacao.foraDoEscopo ? <p role="status" className="text-sm font-medium">{AVISO_FORA_DO_ESCOPO[situacao.foraDoEscopo]}</p> : null}
        <label className="grid gap-1 text-sm">População de referência para o cálculo
          <select className={CAMPO} value={r.populacaoReferencia} onChange={e => mudar({ populacaoReferencia: e.target.value as RespostasPacienteReferencias['populacaoReferencia'], populacaoConfirmada: false })}>
            <option value="nao_informada">Selecione</option><option value="feminina">Feminina</option><option value="masculina">Masculina</option>
          </select></label>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" disabled={r.populacaoReferencia === 'nao_informada'} checked={r.populacaoConfirmada} onChange={e => mudar({ populacaoConfirmada: e.target.checked })} />Conferi a população de referência para esta análise</label>
        <label className="grid gap-1 text-sm">Aplicabilidade da população
          <select className={CAMPO} value={r.aplicabilidade} onChange={e => mudar({ aplicabilidade: e.target.value as RespostasPacienteReferencias['aplicabilidade'] })}>
            <option value="nao_informada">Selecione</option><option value="confirmada">Confirmada para esta análise</option><option value="nao_aplicavel">Não aplicável</option>
          </select></label>
        <label className="grid gap-1 text-sm">Tabagismo
          <select className={CAMPO} value={r.tabagismo} onChange={e => mudar({ tabagismo: e.target.value as RespostasPacienteReferencias['tabagismo'] })}>
            <option value="nao_informado">Não informado</option><option value="nao">Não fuma</option><option value="sim">Fuma</option>
          </select></label>
        <p className="text-xs text-texto-suave">A resposta sobre tabagismo só muda a referência da vitamina C. Sem ela, a vitamina C fica sem comparação.</p>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={p.diaCompleto} onChange={e => { setAberto(true); p.aoMudarDiaCompleto(e.target.checked); }} />As refeições selecionadas formam o dia completo que será comparado</label>
        {!situacao.completo && !situacao.foraDoEscopo ? <p id={`${id}-pendencias`} className="text-sm text-texto-suave">Falta responder: {pendencias}.</p> : null}
        <button type="button" className={BOTAO} disabled={!situacao.completo} aria-describedby={!situacao.completo && !situacao.foraDoEscopo ? `${id}-pendencias` : undefined} onClick={() => { setAberto(false); p.aoAplicar(); }}>Aplicar comparação</button>
      </fieldset> : null}
    </div>
  </section>;
}

/** Avisos e resumo acima da tabela, uma vez (nunca repetidos por nutriente). */
export function AvisosReferencias({ referencias }: { referencias: ReferenciasFactuais }) {
  const resumo = resumirComparacao(referencias);
  return <div className="grid gap-2 text-sm" data-referencias-avisos="true">
    {!referencias.contextoElegivel ? <div role="status" className="grid gap-1">
      <p className="font-medium">{AVISO_CONTEXTO_TITULO}</p>
      <ul className="list-disc pl-5">{referencias.motivosContexto.map(m => <li key={m}>{MOTIVO_CONTEXTO_TEXTO[m]}</li>)}</ul>
    </div> : <p role="status">{textoResumoComparacao(resumo)}</p>}
    <details>
      <summary className="min-h-11 cursor-pointer py-2 text-primaria underline">{COMO_LER_TITULO}</summary>
      <ul className="grid gap-1 pl-5 list-disc">{COMO_LER.map(t => <li key={t}>{t}</li>)}</ul>
      <p className="mt-1 text-xs text-texto-suave">{textoFonteReferencias(referencias)}</p>
    </details>
  </div>;
}

/** Célula da coluna Referência: duas linhas curtas do mesmo padrão em todo nutriente. */
export function CelulaReferencia({ codigo, ativa, comparacao }: { codigo: string; ativa: boolean; comparacao?: ReferenciaNutrienteFactual }) {
  if (!ativa) return <span className="text-texto-suave">Não solicitada</span>;
  if (!comparacao) return <>—</>;
  const { referencia: r, ul } = comparacao;
  const linhas: { chave: string; texto: string }[] = [];
  if (r.estado === 'comparavel') linhas.push({ chave: 'ref', texto: textoReferencia(codigo, r) });
  if (ul.estado === 'comparavel') linhas.push({ chave: 'ul', texto: textoUl(codigo, ul) });
  const curto = (m: keyof typeof MOTIVO_COMPARACAO_CURTO) => m === 'contexto_nao_elegivel' ? '' : `: ${MOTIVO_COMPARACAO_CURTO[m]}`;
  if (r.estado === 'indisponivel' && ul.estado === 'indisponivel' && r.motivo === ul.motivo) {
    linhas.push({ chave: 'ambos', texto: `Não comparável${curto(r.motivo)}` });
  } else {
    if (r.estado === 'indisponivel') linhas.push({ chave: 'ref', texto: `Não comparável${curto(r.motivo)}` });
    // UL não estabelecido é explicado uma vez no "Como ler" e nos detalhes, não repetido em cada linha.
    if (ul.estado === 'indisponivel' && ul.motivo !== 'nao_estabelecido') linhas.push({ chave: 'ul', texto: `UL não comparável${curto(ul.motivo)}` });
  }
  return <>{linhas.map(l => <p key={l.chave}>{l.texto}</p>)}</>;
}

/** Só as exceções da linha, dentro dos detalhes que já existem; o contexto vai no aviso único. */
export function DetalheReferencia({ comparacao }: { comparacao?: ReferenciaNutrienteFactual }) {
  if (!comparacao) return null;
  const itens: { chave: string; texto: string }[] = [];
  for (const [rotulo, c] of [['Referência', comparacao.referencia], ['Limite superior (UL)', comparacao.ul]] as const) {
    if (c.estado !== 'indisponivel' || c.motivo === 'contexto_nao_elegivel') continue;
    if (!(MOTIVOS_COMPARACAO_FACTUAL as readonly string[]).includes(c.motivo)) continue;
    itens.push({ chave: `${rotulo}:${c.motivo}`, texto: `${rotulo}: ${MOTIVO_COMPARACAO_LONGO[c.motivo]}` });
  }
  if (!itens.length) return null;
  return <ul className="mt-1 list-disc pl-5 text-sm" data-referencia-detalhe="true">{itens.map(i => <li key={i.chave}>{i.texto}</li>)}</ul>;
}
