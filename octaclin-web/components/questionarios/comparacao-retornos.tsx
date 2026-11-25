'use client';

import { useEffect, useId, useRef } from 'react';
import { Botao } from '@/components/ui/botao';
import type { ComparacaoRetornosApi } from '@/lib/questionarios-api';
import type { ControleComparacaoRetornos } from './usar-comparacao-retornos';
import { formatarDataResposta } from './usar-workspace-questionarios';

const numero = (n: number) => new Intl.NumberFormat('pt-BR', { maximumSignificantDigits: 21 }).format(n);
type Item = ComparacaoRetornosApi['itens'][number];
const motivos: Record<NonNullable<Item['motivo']>, string> = {
  snapshot_ausente: 'A estrutura original de um dos envios não está disponível.',
  snapshot_invalido: 'A estrutura original não permite uma comparação segura.',
  pergunta_ausente: 'Esta pergunta não consta nos dois envios originais.',
  definicao_alterada: 'A definição da pergunta mudou entre os envios. Os valores não são diretamente comparáveis.',
  sem_resposta: 'Não há resposta nos dois envios para calcular uma diferença.',
  valor_invalido: 'Um dos valores não permite calcular uma diferença válida.',
  parametros_ausentes: 'Os parâmetros originais são insuficientes para calcular uma diferença.',
  nao_numerico: 'Leitura lado a lado; diferença numérica não aplicável.',
  anexo: 'Anexos não possuem diferença numérica. Consulte o envio original para acessá-los.'
};

function Valor({ valor, unidade }: { valor: Item['a']; unidade: string | null }) {
  if (valor.estado === 'sem_resposta') return <>Sem resposta</>;
  if (valor.estado === 'valor_indisponivel') return <>Valor indisponível</>;
  if (valor.estado === 'anexo') return <>{valor.quantidadeArquivos} {valor.quantidadeArquivos === 1 ? 'anexo registrado' : 'anexos registrados'}</>;
  const v = valor.valor;
  const texto = typeof v === 'number' ? numero(v) : typeof v === 'boolean' ? (v ? 'Sim' : 'Não') : Array.isArray(v) ? v.join(', ') : v;
  return <>{texto}{unidade ? ` ${unidade}` : ''}</>;
}

export function ComparacaoRetornos({ controle, nomePaciente }: { controle: ControleComparacaoRetornos; nomePaciente: (id: string) => string }) {
  const id = useId();
  const titulo = useRef<HTMLHeadingElement>(null);
  const comparar = useRef<HTMLButtonElement>(null);
  const devolverFoco = useRef(false);
  const resultado = controle.resultado;
  useEffect(() => {
    if (resultado || controle.erro) titulo.current?.focus();
    else if (devolverFoco.current) { comparar.current?.focus(); devolverFoco.current = false; }
  }, [resultado, controle.erro, controle.carregando]);
  function fechar() { devolverFoco.current = true; controle.fechar(); }
  return (
    <section data-qst10-comparacao aria-labelledby={`${id}-titulo`} className="mb-4 grid min-w-0 gap-3 rounded-md border border-linha bg-white p-3 [overflow-wrap:anywhere]">
      <h3 id={`${id}-titulo`} ref={titulo} tabIndex={-1} className="text-sm font-semibold text-tinta">Comparar dois retornos</h3>
      <p className="text-sm text-texto-suave">Selecione dois envios do mesmo paciente, inclusive em páginas diferentes. A comparação usa as perguntas originais e não altera as respostas.</p>
      <p role="status" aria-live="polite" className="text-sm">{controle.selecionadas.length} de 2 selecionados</p>
      <ul className="grid min-w-0 gap-2 md:grid-cols-2" aria-label="Retornos selecionados">
        {controle.selecionadas.map((s, indice) => <li key={s.respostaId} className="min-w-0 rounded border border-linha p-2 text-sm">
          <p>{nomePaciente(s.pacienteId)}</p>
          <p>{s.timezone ? formatarDataResposta(s.finalizadoEm, s.timezone) : (s.finalizadoEm ?? 'Sem data')}</p>
          <Botao type="button" tamanho="sm" aria-label={`Remover da comparação: retorno ${indice + 1}`} onClick={() => controle.remover(s.respostaId)}>Remover da comparação</Botao>
        </li>)}
      </ul>
      <div className="flex min-w-0 flex-wrap gap-2 [&>button]:max-w-full [&>button]:whitespace-normal">
        <Botao ref={comparar} type="button" disabled={controle.selecionadas.length !== 2 || controle.carregando} onClick={() => void controle.comparar()}>Comparar selecionados</Botao>
        {controle.selecionadas.length > 0 && <Botao type="button" onClick={controle.limpar}>Limpar seleção</Botao>}
        {(controle.carregando || resultado) && <Botao type="button" onClick={fechar}>{controle.carregando ? 'Cancelar comparação' : 'Voltar à seleção'}</Botao>}
      </div>
      {controle.carregando && <p role="status">Consultando os retornos selecionados...</p>}
      {controle.erro && <p role="alert" className="text-sm">{controle.erro}</p>}
      {resultado && <section aria-label="Comparação dos retornos" className="grid min-w-0 gap-3">
        <p className="text-sm text-texto-suave">{resultado.ordem === 'cronologica' ? 'A é o envio anterior; B é o posterior.' : 'A e B seguem a ordem de seleção. As datas disponíveis não permitem estabelecer uma ordem cronológica.'} As diferenças são descritivas e não indicam melhora ou piora clínica.</p>
        <div className="grid min-w-0 gap-2 md:grid-cols-2">
          {(['a', 'b'] as const).map(lado => <div key={lado} className="min-w-0 rounded border border-linha p-2 text-sm">
            <p className="font-semibold">Envio {lado.toUpperCase()}</p>
            <p>{formatarDataResposta(resultado[lado].finalizadoEm ?? undefined, resultado.timezone)}</p>
            <p>{resultado[lado].versaoQuestionario === null ? 'Versão indisponível' : `Versão ${resultado[lado].versaoQuestionario}`}</p>
          </div>)}
        </div>
        {!resultado.itens.length && <p className="text-sm">Nenhuma pergunta original disponível para comparação.</p>}
        {resultado.itens.map(item => <article key={item.perguntaId} className="grid min-w-0 gap-2 rounded border border-linha p-3 text-sm">
          <h4 className="font-semibold">{item.enunciadoA ?? item.enunciadoB ?? 'Pergunta original indisponível'}</h4>
          <dl className="grid min-w-0 gap-2 md:grid-cols-2">
            {(['a', 'b'] as const).map(lado => <div key={lado} className="min-w-0">
              <dt className="font-medium">Envio {lado.toUpperCase()}{item.enunciadoA !== item.enunciadoB ? ` — ${item[lado === 'a' ? 'enunciadoA' : 'enunciadoB'] ?? 'Pergunta ausente'}` : ''}</dt>
              <dd className="whitespace-pre-wrap"><Valor valor={item[lado]} unidade={item[lado === 'a' ? 'unidadeA' : 'unidadeB']} /></dd>
            </div>)}
          </dl>
          {item.delta !== null ? <p>{item.delta > 0 ? `Aumentou: +${numero(item.delta)}` : item.delta < 0 ? `Diminuiu: ${numero(item.delta)}` : 'Sem alteração numérica'}{item.unidade ? ` ${item.unidade}` : ''}</p>
            : <p className="text-texto-suave">{item.motivo ? motivos[item.motivo] : 'Diferença numérica indisponível.'}</p>}
        </article>)}
      </section>}
    </section>
  );
}
