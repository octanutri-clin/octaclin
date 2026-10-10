'use client';

import { motivoGestacional, fonteGestacional } from '@/lib/linguagem-gestacional';

import { FormularioContextoGestacional } from './formulario-contexto-gestacional';
import type { ContextoGestacaoApi } from '@/lib/gestacoes-paciente-api';
import { GestacoesPaciente } from './gestacoes-paciente';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { BarraCarregamento } from '@/components/ui/feedback';
import { GraficoEvolucao, PontoEvolucao } from '@/components/ui/grafico-evolucao';
import { METRICAS_ANTROPOMETRICAS } from './metricas-antropometricas';
import { SeletorConsultaRecente } from './seletor-consulta-recente';
import { ModelosTextoClinico } from './modelos-texto-clinico';
import { useRequisicaoCancelavel } from '@/lib/hooks';
import { mensagemFalhaInterface } from '@/lib/erros-interface';
import { obterPerfilCadastroPaciente } from '@/lib/perfil-cadastro-paciente-api';
import {
  ProtocoloComposicao,
  SerieAntropometricaApi,
  SexoBiologico,
  excluirAvaliacaoAntropometrica,
  atualizarCompartilhamentoProgresso,
  listarAvaliacoesAntropometricas,
  registrarAvaliacaoAntropometrica
} from '@/lib/prontuario-api';

/** Espelha `dobrasExigidas` do dominio: o backend recusa se faltar sitio. */
const DOBRAS_POR_PROTOCOLO: Record<ProtocoloComposicao, Record<SexoBiologico, string[]>> = {
  nenhum: { masculino: [], feminino: [] },
  pollock_3: {
    masculino: ['peitoral', 'abdominal', 'coxa'],
    feminino: ['triceps', 'suprailiaca', 'coxa']
  },
  pollock_7: {
    masculino: ['peitoral', 'axilarMedia', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa'],
    feminino: ['peitoral', 'axilarMedia', 'triceps', 'subescapular', 'abdominal', 'suprailiaca', 'coxa']
  },
  faulkner: {
    masculino: ['triceps', 'subescapular', 'suprailiaca', 'abdominal'],
    feminino: ['triceps', 'subescapular', 'suprailiaca', 'abdominal']
  },
  guedes: {
    masculino: ['triceps', 'suprailiaca', 'abdominal'],
    feminino: ['coxa', 'suprailiaca', 'subescapular']
  }
};

const ROTULO_DOBRA: Record<string, string> = {
  peitoral: 'Peitoral',
  axilarMedia: 'Axilar media',
  triceps: 'Triceps',
  subescapular: 'Subescapular',
  abdominal: 'Abdominal',
  suprailiaca: 'Suprailiaca',
  coxa: 'Coxa',
  panturrilha: 'Panturrilha'
};

const ROTULO_PROTOCOLO: Record<ProtocoloComposicao, string> = {
  nenhum: 'Sem composicao corporal',
  pollock_3: 'Pollock 3 dobras',
  pollock_7: 'Pollock 7 dobras',
  faulkner: 'Faulkner',
  guedes: 'Guedes'
};

const ROTULO_CLASSIFICACAO: Record<string, string> = {
  baixo_peso: 'Baixo peso',
  eutrofia: 'Eutrofia',
  sobrepeso: 'Sobrepeso',
  obesidade_grau_1: 'Obesidade grau I',
  obesidade_grau_2: 'Obesidade grau II',
  obesidade_grau_3: 'Obesidade grau III',
  abaixo_do_corte: 'Abaixo do corte de risco',
  elevado: 'Risco elevado',
  baixo: 'Baixo',
  aumentado: 'Aumentado',
  muito_aumentado: 'Muito aumentado'
};

/** Aviso do dominio traduzido. O generico com prefixo cobre `dobra_ausente:coxa`. */
const ROTULO_AVISO: Record<string, string> = {
  gestante_sem_interpretacao_adulta_cintura_rcq_composicao: 'Gestante: medidas preservadas, sem interpretação adulta de cintura/RCQ ou estimativa de composição corporal.',
  peso_fora_da_faixa: 'Peso fora da faixa aceita.',
  altura_fora_da_faixa: 'Altura fora da faixa aceita.',
  imc_fora_da_faixa_plausivel: 'Peso e altura juntos dao um IMC impossivel. Confira os dois.',
  imc_sem_classificacao_idade_ausente: 'IMC calculado, mas sem classificacao: falta a data de nascimento no cadastro.',
  imc_sem_classificacao_menor_de_20_exige_escore_z:
    'Menor de 20 anos: o IMC nao e classificado por corte de adulto, exige escore-z da OMS.',
  imc_sem_classificacao_gestante_exige_semana_gestacional:
    'Gestante: o IMC foi calculado, mas a classificação requer avaliação por semana gestacional.',
  rcq_sem_classificacao_sexo_ausente: 'RCQ calculado, mas sem classificacao: informe o sexo.',
  protocolo_exige_sexo: 'O protocolo escolhido precisa do sexo para calcular.',
  protocolo_exige_idade: 'O protocolo de Pollock precisa da idade (data de nascimento no cadastro).',
  soma_dobras_fora_da_faixa_de_validacao:
    'Soma de dobras acima da faixa de validacao do protocolo. Acima dela a equacao inverte, entao o percentual nao foi calculado.',
  idade_fora_da_faixa_de_validacao_da_equacao: 'Idade fora da amostra em que a equacao foi validada: trate como estimativa.',
  equacao_de_adulto_aplicada_a_menor_de_idade:
    'Equacao de adulto aplicada a menor de idade. Nao e valida antes da maturidade.',
  percentual_gordura_implausivel: 'O percentual de gordura resultante e impossivel. Confira as dobras.',
  percentual_gordura_abaixo_da_gordura_essencial: 'Percentual abaixo da gordura essencial: confira a medida.',
  massa_sem_peso_valido: 'Massa gorda e magra exigem peso valido.',
  registro_ilegivel: 'Nao foi possivel ler este registro (falha tecnica). Avise o suporte.'
};

function traduzirAviso(aviso: string) {
  if (aviso.startsWith('dobra_ausente:')) {
    return `Falta a dobra ${ROTULO_DOBRA[aviso.split(':')[1]] ?? aviso.split(':')[1]}.`;
  }
  if (aviso.startsWith('dobra_fora_da_faixa:')) {
    return `Dobra ${ROTULO_DOBRA[aviso.split(':')[1]] ?? aviso.split(':')[1]} fora da faixa de um adipometro.`;
  }
  return ROTULO_AVISO[aviso] ?? aviso;
}

const ROTULO_DELTA: Record<string, { rotulo: string; unidade: string }> = {
  pesoKg: { rotulo: 'Peso', unidade: 'kg' },
  imc: { rotulo: 'IMC', unidade: '' },
  rcq: { rotulo: 'RCQ', unidade: '' },
  percentualGordura: { rotulo: 'Gordura corporal', unidade: '%' },
  massaGordaKg: { rotulo: 'Massa gorda', unidade: 'kg' },
  massaMagraKg: { rotulo: 'Massa magra', unidade: 'kg' }
};

interface FormularioAvaliacao {
  avaliadaEm: string;
  protocolo: ProtocoloComposicao;
  sexo: SexoBiologico | '';
  pesoKg: string;
  alturaCm: string;
  observacoes: string;
  cintura: string;
  quadril: string;
  dobras: Record<string, string>;
  /** PB-24 (Fase 275): consulta de origem, opcional. */
  consultaId: string;
  metricasCompartilhadasPortal: MetricaPortal[];
}

type MetricaPortal = 'imc' | 'percentualGordura' | 'massaMagraKg';
const OPCOES_METRICAS_PORTAL: { id: MetricaPortal; rotulo: string }[] = [
  { id: 'imc', rotulo: 'IMC' },
  { id: 'percentualGordura', rotulo: 'Gordura corporal' },
  { id: 'massaMagraKg', rotulo: 'Massa magra' }
];

function formularioInicial(): FormularioAvaliacao {
  return {
    avaliadaEm: new Date().toISOString().slice(0, 10),
    protocolo: 'nenhum',
    sexo: '',
    pesoKg: '',
    alturaCm: '',
    observacoes: '',
    cintura: '',
    quadril: '',
    dobras: {},
    consultaId: '',
    metricasCompartilhadasPortal: []
  };
}

function numero(texto: string): number | undefined {
  const valor = Number(texto.replace(',', '.'));
  return texto.trim() && Number.isFinite(valor) ? valor : undefined;
}

function formatar(valor: number | undefined, casas = 1) {
  return valor === undefined
    ? '-'
    : valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

interface AbaAntropometriaProps {
  pacienteId: string;
  podeGerenciar: boolean;
  dataNascimento?: string;
}

export function AbaAntropometria(props: AbaAntropometriaProps) {
  return <AbaAntropometriaConteudo key={props.pacienteId} {...props}/>;
}
function AbaAntropometriaConteudo({ pacienteId, podeGerenciar, dataNascimento }: AbaAntropometriaProps) {
  const [condicaoAvaliacao,setCondicaoAvaliacao] = useState<'gestante'|'nao_gestante'|''>('');
  const [confirmouCondicao,setConfirmouCondicao] = useState(false);
  const [confirmouDivergencia,setConfirmouDivergencia] = useState(false);
  const [contextoGestacao,setContextoGestacao] = useState<ContextoGestacaoApi>({});
  const vivo = useRef(false);
  const chaveAvaliacao = useRef<{ body: string; id: string }|null>(null);
  useEffect(() => {vivo.current = true;return () => {vivo.current = false;};},[]);

  const [serie, setSerie] = useState<SerieAntropometricaApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<FormularioAvaliacao>(formularioInicial);
  const [condicaoBiologica, setCondicaoBiologica] = useState<string | null>(null);
  const [metricaId, setMetricaId] = useState('peso');
  const [avaliacaoAnteriorId, setAvaliacaoAnteriorId] = useState('');
  const [avaliacaoAtualId, setAvaliacaoAtualId] = useState('');
  const [deltaSelecionado, setDeltaSelecionado] = useState<SerieAntropometricaApi['deltaSelecionado']>(undefined);
  const [comparando, setComparando] = useState(false);
  const [erroComparacao, setErroComparacao] = useState<string | null>(null);
  const iniciarRequisicao = useRequisicaoCancelavel();

  const carregar = useCallback(async () => {
    const { signal, ehAtual } = iniciarRequisicao();
    setCarregando(true);
    try {
      const dados = await listarAvaliacoesAntropometricas(pacienteId, { signal });
      if (!ehAtual()) return;
      setSerie(dados);
    } catch (erroAtual) {
      if (!ehAtual()) return;
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível carregar as avaliações.'));
    } finally {
      if (ehAtual()) setCarregando(false);
    }
  }, [iniciarRequisicao, pacienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  useEffect(() => {
    let ativo = true;
    void obterPerfilCadastroPaciente(pacienteId)
      .then((perfil) => { if (ativo) setCondicaoBiologica(perfil.identificacao?.condicaoBiologica ?? 'nao_informada'); })
      .catch(() => { if (ativo) setCondicaoBiologica(null); });
    return () => { ativo = false; };
  }, [pacienteId]);

  const pesoPrevia = numero(formulario.pesoKg);
  const alturaPrevia = numero(formulario.alturaCm);
  const imcBruto = pesoPrevia !== undefined && alturaPrevia !== undefined &&
    pesoPrevia >= 1 && pesoPrevia <= 500 && alturaPrevia >= 30 && alturaPrevia <= 250
    ? pesoPrevia / (alturaPrevia / 100) ** 2 : undefined;
  const imcPrevia = imcBruto !== undefined && imcBruto >= 8 && imcBruto <= 100 ? imcBruto : undefined;
  const idadePrevia = (() => {
    if (!dataNascimento || !/^\d{4}-\d{2}-\d{2}$/.test(formulario.avaliadaEm)) return undefined;
    const [ano, mes, dia] = formulario.avaliadaEm.split('-').map(Number);
    const [anoN, mesN, diaN] = dataNascimento.split('-').map(Number);
    if (![ano, mes, dia, anoN, mesN, diaN].every(Number.isFinite)) return undefined;
    return ano - anoN - (mes < mesN || (mes === mesN && dia < diaN) ? 1 : 0);
  })();
  const classePrevia = imcPrevia === undefined || condicaoBiologica === null ||
    (condicaoAvaliacao === 'gestante' || !confirmouCondicao) || idadePrevia === undefined || idadePrevia < 20
    ? undefined
    : idadePrevia >= 60
      ? imcPrevia < 22 ? 'baixo_peso' : imcPrevia <= 27 ? 'eutrofia' : 'sobrepeso'
      : imcPrevia < 18.5 ? 'baixo_peso' : imcPrevia < 25 ? 'eutrofia'
        : imcPrevia < 30 ? 'sobrepeso' : imcPrevia < 35 ? 'obesidade_grau_1'
          : imcPrevia < 40 ? 'obesidade_grau_2' : 'obesidade_grau_3';

  const sitiosExigidos = useMemo(
    () => (formulario.sexo ? DOBRAS_POR_PROTOCOLO[formulario.protocolo][formulario.sexo] : []),
    [formulario.protocolo, formulario.sexo]
  );

  const metrica = METRICAS_ANTROPOMETRICAS.find((item) => item.id === metricaId) ?? METRICAS_ANTROPOMETRICAS[0];
  const pontos: PontoEvolucao[] = useMemo(() => {
    if (!serie) return [];
    return serie.avaliacoes
      .map((avaliacao) => ({ data: avaliacao.avaliadaEm, valor: metrica.ler(avaliacao) }))
      .filter((ponto): ponto is PontoEvolucao => ponto.valor !== undefined);
  }, [metrica, serie]);

  async function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setSucesso(null);

    if (!condicaoAvaliacao || !confirmouCondicao) {setErro('Confirme a condição na data da avaliação.');return;}
    if (condicaoAvaliacao !== 'gestante' && formulario.protocolo !== 'nenhum' && !formulario.sexo) {
      setErro('Informe o sexo: os protocolos de composição corporal usam equações diferentes por sexo.');
      return;
    }

    setSalvando(true);
    try {
      const dobras: Record<string, number> = {};
      for (const sitio of sitiosExigidos) {
        const valor = numero(formulario.dobras[sitio] ?? '');
        if (valor !== undefined) dobras[sitio] = valor;
      }
      const circunferencias: Record<string, number> = {};
      const cintura = numero(formulario.cintura);
      const quadril = numero(formulario.quadril);
      if (cintura !== undefined) circunferencias.cintura = cintura;
      if (quadril !== undefined) circunferencias.quadril = quadril;

      const corpoAvaliacao = {
        condicaoGestacional: condicaoAvaliacao,
        confirmarDivergenciaPerfil: confirmouDivergencia,
        ...(condicaoAvaliacao === 'gestante' ? { gestacao: contextoGestacao } : {}),
        avaliadaEm: formulario.avaliadaEm,
        protocolo: formulario.protocolo,
        sexo: formulario.sexo || undefined,
        pesoKg: numero(formulario.pesoKg),
        alturaCm: numero(formulario.alturaCm),
        observacoes: formulario.observacoes.trim() || undefined,
        ...(Object.keys(circunferencias).length ? { circunferencias } : {}),
        ...(Object.keys(dobras).length ? { dobras } : {}),
        consultaId: formulario.consultaId || undefined,
        metricasCompartilhadasPortal: formulario.metricasCompartilhadasPortal
      };
      const body = JSON.stringify(corpoAvaliacao);
      if (!chaveAvaliacao.current || chaveAvaliacao.current.body !== body) chaveAvaliacao.current = { body,id: crypto.randomUUID() };
      await registrarAvaliacaoAntropometrica(pacienteId,{ ...corpoAvaliacao,chaveCriacao: chaveAvaliacao.current.id });
      if (!vivo.current) return;
      chaveAvaliacao.current = null;setConfirmouCondicao(false);setConfirmouDivergencia(false);setContextoGestacao({});
      setFormulario((atual) => ({ ...formularioInicial(), protocolo: atual.protocolo, sexo: atual.sexo }));
      setSucesso('Avaliação registrada.');
      await carregar();
    } catch (erroAtual) {
      if (!vivo.current) return;
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível registrar a avaliação.'));
    } finally {
      if (vivo.current) setSalvando(false);
    }
  }

  async function excluir(avaliacaoId: string) {
    setErro(null);
    setSucesso(null);
    try {
      await excluirAvaliacaoAntropometrica(pacienteId, avaliacaoId);
      if (!vivo.current) return;
      setSucesso('Avaliação removida da série.');
      await carregar();
    } catch (erroAtual) {
      if (!vivo.current) return;
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível remover a avaliação.'));
    }
  }

  async function alterarCompartilhamento(avaliacaoId: string, metricas: MetricaPortal[]) {
    setErro(null);
    try {
      await atualizarCompartilhamentoProgresso(pacienteId, avaliacaoId, metricas);
      if (!vivo.current) return;
      setSucesso('Compartilhamento do progresso atualizado.');
      await carregar();
    } catch (erroAtual) {
      if (!vivo.current) return;
      setErro(mensagemFalhaInterface(erroAtual, 'Não foi possível atualizar o compartilhamento.'));
    }
  }

  async function comparar() {
    if (!avaliacaoAnteriorId || !avaliacaoAtualId) return;
    setErroComparacao(null);
    setDeltaSelecionado(undefined);
    setComparando(true);
    try {
      const dados = await listarAvaliacoesAntropometricas(pacienteId, { avaliacaoAnteriorId, avaliacaoAtualId });
      if (!vivo.current) return;
      setDeltaSelecionado(dados.deltaSelecionado ?? []);
    } catch (erroAtual) {
      if (!vivo.current) return;
      setErroComparacao(mensagemFalhaInterface(erroAtual, 'Não foi possível comparar as avaliações.'));
    } finally {
      if (vivo.current) setComparando(false);
    }
  }

  const ultima = serie?.avaliacoes[0];

  return (
    <div className="grid gap-4">
      <GestacoesPaciente key={pacienteId} pacienteId={pacienteId} podeGerenciar={podeGerenciar}/>
      {erro ? (
        <p role="alert" className="rounded-md border border-perigo-borda bg-perigo-suave p-3 text-sm text-perigo-forte">
          {erro}
        </p>
      ) : null}
      {sucesso ? (
        <p role="status" className="rounded-md border border-sucesso-borda bg-sucesso-suave p-3 text-sm text-sucesso-forte">
          {sucesso}
        </p>
      ) : null}

      <Cartao>
        <CartaoCabecalho className="flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CartaoTitulo>Evolução das medidas</CartaoTitulo>
          <div className="flex items-center gap-3">
            <BarraCarregamento visivel={carregando} rotulo="Carregando avaliações" />
            <label className="flex items-center gap-2">
              <Rotulo className="whitespace-nowrap">Metrica</Rotulo>
              <Selecao
                aria-label="Metrica do gráfico"
                value={metricaId}
                onChange={(evento) => setMetricaId(evento.target.value)}
              >
                {METRICAS_ANTROPOMETRICAS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.rotulo}
                  </option>
                ))}
              </Selecao>
            </label>
          </div>
        </CartaoCabecalho>
        <CartaoConteudo>
          <GraficoEvolucao
            pontos={pontos}
            rotulo={metrica.rotulo}
            unidade={metrica.unidade}
            casas={metrica.casas}
            descricao="Uma metrica por vez: peso e percentual tem escalas diferentes e não dividem eixo."
          />
        </CartaoConteudo>
      </Cartao>

      {serie?.deltaUltimas.length ? (
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Variacao desde a avaliação anterior</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {serie.deltaUltimas.map((delta) => {
                const meta = ROTULO_DELTA[delta.campo] ?? { rotulo: delta.campo, unidade: '' };
                const sinal = delta.variacao > 0 ? '+' : '';
                return (
                  <li key={delta.campo} className="rounded-md border border-linha bg-superficie p-3">
                    <p className="text-xs text-texto-suave">{meta.rotulo}</p>
                    <p className="text-sm font-semibold text-tinta">
                      {sinal}
                      {formatar(delta.variacao, 2)} {meta.unidade}
                    </p>
                    <p className="text-xs text-texto-suave">
                      {formatar(delta.anterior, 2)} para {formatar(delta.atual, 2)}
                    </p>
                  </li>
                );
              })}
            </ul>
          </CartaoConteudo>
        </Cartao>
      ) : null}

      {serie && serie.avaliacoes.length >= 2 ? (
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Comparar avaliações</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="grid gap-1">
                <Rotulo>De</Rotulo>
                <Selecao
                  aria-label="Avaliação anterior para comparar"
                  value={avaliacaoAnteriorId}
                  disabled={comparando}
                  onChange={(evento) => {
                    setAvaliacaoAnteriorId(evento.target.value);
                    setDeltaSelecionado(undefined);
                    setErroComparacao(null);
                  }}
                >
                  <option value="">Selecionar avaliação</option>
                  {serie.avaliacoes.map((avaliacao) => (
                    <option key={avaliacao.id} value={avaliacao.id}>
                      {formatarData(avaliacao.avaliadaEm)}
                    </option>
                  ))}
                </Selecao>
              </label>
              <label className="grid gap-1">
                <Rotulo>Para</Rotulo>
                <Selecao
                  aria-label="Avaliação atual para comparar"
                  value={avaliacaoAtualId}
                  disabled={comparando}
                  onChange={(evento) => {
                    setAvaliacaoAtualId(evento.target.value);
                    setDeltaSelecionado(undefined);
                    setErroComparacao(null);
                  }}
                >
                  <option value="">Selecionar avaliação</option>
                  {serie.avaliacoes.map((avaliacao) => (
                    <option key={avaliacao.id} value={avaliacao.id}>
                      {formatarData(avaliacao.avaliadaEm)}
                    </option>
                  ))}
                </Selecao>
              </label>
              <Botao
                type="button"
                disabled={!avaliacaoAnteriorId || !avaliacaoAtualId || comparando}
                onClick={() => void comparar()}
              >
                Comparar
              </Botao>
            </div>
            {erroComparacao ? (
              <p role="alert" className="mt-3 text-sm text-perigo-forte">
                {erroComparacao}
              </p>
            ) : null}
            {deltaSelecionado ? (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {deltaSelecionado.length ? (
                  deltaSelecionado.map((delta) => {
                    const meta = ROTULO_DELTA[delta.campo] ?? { rotulo: delta.campo, unidade: '' };
                    const sinal = delta.variacao > 0 ? '+' : '';
                    return (
                      <li key={delta.campo} className="rounded-md border border-linha bg-superficie p-3">
                        <p className="text-xs text-texto-suave">{meta.rotulo}</p>
                        <p className="text-sm font-semibold text-tinta">
                          {sinal}
                          {formatar(delta.variacao, 2)} {meta.unidade}
                        </p>
                        <p className="text-xs text-texto-suave">
                          {formatar(delta.anterior, 2)} para {formatar(delta.atual, 2)}
                        </p>
                      </li>
                    );
                  })
                ) : (
                  <li className="text-sm text-texto-suave">Nenhuma medida em comum entre as duas avaliações.</li>
                )}
              </ul>
            ) : null}
          </CartaoConteudo>
        </Cartao>
      ) : null}

      {podeGerenciar ? (
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Nova avaliação</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <form onSubmit={salvar} className="grid gap-3">
          <fieldset className="grid gap-3 sm:col-span-2">
            <legend className="font-semibold">Condição na data da avaliação</legend>
            <p className="text-sm">Cadastro atual: {condicaoBiologica?.replaceAll('_',' ') ?? 'indisponível'}. Confirme a condição para a data registrada.</p>
            <label>Condição<Selecao required value={condicaoAvaliacao} onChange={e => {setCondicaoAvaliacao(e.target.value as 'gestante'|'nao_gestante');setConfirmouCondicao(false);setConfirmouDivergencia(false);setContextoGestacao({});}}><option value="">Confirme a condição</option><option value="nao_gestante">Não gestante</option><option value="gestante">Gestante</option></Selecao></label>
            <label><input type="checkbox" required checked={confirmouCondicao} onChange={e => setConfirmouCondicao(e.target.checked)}/> Confirmo a condição e a idade gestacional informadas para a data desta avaliação.</label>
            {condicaoBiologica && condicaoBiologica !== 'nao_informada' && condicaoAvaliacao && (condicaoAvaliacao === 'gestante') !== (condicaoBiologica === 'gestante') ? <label><input type="checkbox" required checked={confirmouDivergencia} onChange={e => setConfirmouDivergencia(e.target.checked)}/> Confirmo a divergência com o cadastro atual; o cadastro não será alterado.</label> : null}
            {condicaoAvaliacao === 'gestante' ? <FormularioContextoGestacional key={pacienteId} pacienteId={pacienteId} contexto={contextoGestacao} alterar={c => {setContextoGestacao(c);setConfirmouCondicao(false);}}/> : null}
          </fieldset>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="grid gap-1">
                  <Rotulo>Data</Rotulo>
                  <Campo
                    type="date"
                    value={formulario.avaliadaEm}
                    onChange={(evento) => { setFormulario((atual) => ({ ...atual, avaliadaEm: evento.target.value })); setContextoGestacao({}); setConfirmouCondicao(false); }}
                  />
                </label>
                <label className="grid gap-1">
                  <Rotulo>Peso (kg)</Rotulo>
                  <Campo
                    inputMode="decimal"
                    value={formulario.pesoKg}
                    onChange={(evento) => setFormulario((atual) => ({ ...atual, pesoKg: evento.target.value }))}
                  />
                </label>
                <label className="grid gap-1">
                  <Rotulo>Altura (cm)</Rotulo>
                  <Campo
                    inputMode="decimal"
                    value={formulario.alturaCm}
                    onChange={(evento) => setFormulario((atual) => ({ ...atual, alturaCm: evento.target.value }))}
                  />
                </label>
                <label className="grid gap-1">
                  <Rotulo>Sexo</Rotulo>
                  <Selecao
                    value={formulario.sexo}
                    onChange={(evento) =>
                      setFormulario((atual) => ({ ...atual, sexo: evento.target.value as SexoBiologico | '' }))
                    }
                  >
                    <option value="">Não informado</option>
                    <option value="feminino">Feminino</option>
                    <option value="masculino">Masculino</option>
                  </Selecao>
                </label>
              </div>

              <div className="rounded-md border border-linha bg-superficie p-3" aria-live="polite">
                <p className="text-sm font-semibold text-tinta">IMC calculado automaticamente</p>
                <p className="text-sm text-tinta">
                  {imcPrevia === undefined ? 'Preencha peso e altura em centímetros dentro das faixas aceitas.' :
                    `${formatar(imcPrevia, 2)} kg/m²${classePrevia ? ` · ${ROTULO_CLASSIFICACAO[classePrevia]}` : ''}`}
                </p>
                {imcPrevia !== undefined && !classePrevia ? <p className="text-xs text-texto-suave">
                  {condicaoAvaliacao === 'gestante' ? 'Gestante: classificação depende da semana gestacional e do peso de referência.' :
                    idadePrevia !== undefined && idadePrevia < 20 ? 'Menor de 20 anos: classificação exige escore-z por idade e sexo.' :
                      'Classificação disponível após confirmação dos dados cadastrais.'}
                </p> : null}
                <p className="text-xs text-texto-suave">Prévia. O registro definitivo é calculado pelo servidor ao salvar.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="grid gap-1">
                  <Rotulo>Cintura (cm)</Rotulo>
                  <Campo
                    inputMode="decimal"
                    value={formulario.cintura}
                    onChange={(evento) => setFormulario((atual) => ({ ...atual, cintura: evento.target.value }))}
                  />
                </label>
                <label className="grid gap-1">
                  <Rotulo>Quadril (cm)</Rotulo>
                  <Campo
                    inputMode="decimal"
                    value={formulario.quadril}
                    onChange={(evento) => setFormulario((atual) => ({ ...atual, quadril: evento.target.value }))}
                  />
                </label>
                <label className="grid gap-1 sm:col-span-2">
                  <Rotulo>Protocolo de composição</Rotulo>
                  <Selecao
                    value={formulario.protocolo}
                    onChange={(evento) =>
                      setFormulario((atual) => ({
                        ...atual,
                        protocolo: evento.target.value as ProtocoloComposicao,
                        dobras: {}
                      }))
                    }
                  >
                    {(Object.keys(ROTULO_PROTOCOLO) as ProtocoloComposicao[]).map((protocolo) => (
                      <option key={protocolo} value={protocolo}>
                        {ROTULO_PROTOCOLO[protocolo]}
                      </option>
                    ))}
                  </Selecao>
                </label>
              </div>

              {formulario.protocolo !== 'nenhum' && !formulario.sexo ? (
                <p className="text-sm text-texto-suave">
                  Informe o sexo para ver quais dobras este protocolo exige: as equações e os sitios mudam por sexo.
                </p>
              ) : null}

              {sitiosExigidos.length ? (
                <fieldset className="grid gap-3 rounded-md border border-linha p-3">
                  <legend className="px-1 text-sm font-medium text-tinta">Dobras cutaneas (mm)</legend>
                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {sitiosExigidos.map((sitio) => (
                      <label key={sitio} className="grid gap-1">
                        <Rotulo>{ROTULO_DOBRA[sitio] ?? sitio}</Rotulo>
                        <Campo
                          inputMode="decimal"
                          value={formulario.dobras[sitio] ?? ''}
                          onChange={(evento) =>
                            setFormulario((atual) => ({
                              ...atual,
                              dobras: { ...atual.dobras, [sitio]: evento.target.value }
                            }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              <SeletorConsultaRecente
                pacienteId={pacienteId}
                value={formulario.consultaId}
                onChange={(consultaId) => setFormulario((atual) => ({ ...atual, consultaId }))}
                disabled={salvando}
              />

              <label className="grid gap-1">
                <Rotulo>Observações da avaliação</Rotulo>
                <AreaTexto rows={4} value={formulario.observacoes} maxLength={2000}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, observacoes: evento.target.value }))} />
              </label>
              <ModelosTextoClinico tipo="observacao_antropometrica" conteudoAtual={formulario.observacoes}
                aoAplicar={(observacoes) => setFormulario((atual) => ({ ...atual, observacoes }))} desabilitado={salvando} />

              <fieldset className="grid gap-2 rounded-md border border-linha p-3">
                <legend className="px-1 text-sm font-medium text-tinta">Compartilhar no progresso do paciente</legend>
                <p className="text-xs text-texto-suave">Serão exibidos apenas os valores calculados e selecionados, com data e origem.</p>
                {OPCOES_METRICAS_PORTAL.map((metrica) => (
                  <label key={metrica.id} className="flex items-center gap-2 text-sm text-texto-suave">
                    <input type="checkbox" checked={formulario.metricasCompartilhadasPortal.includes(metrica.id)}
                      onChange={(evento) => setFormulario((atual) => ({
                        ...atual,
                        metricasCompartilhadasPortal: evento.target.checked
                          ? [...atual.metricasCompartilhadasPortal, metrica.id]
                          : atual.metricasCompartilhadasPortal.filter((id) => id !== metrica.id)
                      }))} />
                    {metrica.rotulo}
                  </label>
                ))}
              </fieldset>

              <div className="flex justify-end">
                <Botao type="submit" variante="primario" disabled={salvando}>
                  {salvando ? 'Registrando' : 'Registrar avaliação'}
                </Botao>
              </div>
            </form>
          </CartaoConteudo>
        </Cartao>
      ) : null}

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Avaliações registradas</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          {ultima?.resultado.avisos.length ? (
            <ul className="mb-3 grid gap-1 rounded-md border border-alerta-borda bg-alerta-suave p-3 text-sm text-alerta-forte">
              {ultima.resultado.avisos.map((aviso) => (
                <li key={aviso}>{traduzirAviso(aviso)}</li>
              ))}
            </ul>
          ) : null}

          {serie?.avaliacoes.length ? (
            <div className="grid gap-3">
              {serie.avaliacoes.map((avaliacao) => (
                <article key={avaliacao.id} className="rounded-md border border-linha bg-superficie p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-tinta">{formatarData(avaliacao.avaliadaEm)}</p>
                      <p className="text-xs text-texto-suave">
                        {ROTULO_PROTOCOLO[avaliacao.protocolo]}
                        {avaliacao.idadeAnos !== undefined ? ` - ${avaliacao.idadeAnos} anos na avaliacao` : ''}
                      </p>
                    </div>
                    {podeGerenciar ? (
                      <Botao type="button" variante="perigo" onClick={() => void excluir(avaliacao.id)}>
                        Remover
                      </Botao>
                    ) : null}
                  </div>
                  {avaliacao.resultado.gestacional?.condicao === 'gestante' ? <div className="mt-3 text-sm">
                    <p>IMC de referência: {avaliacao.resultado.gestacional.imcReferencia?.toFixed(2) ?? '—'}. Ganho acumulado: {avaliacao.resultado.gestacional.ganhoKg?.toLocaleString('pt-BR') ?? '—'} kg. Referência {avaliacao.resultado.gestacional.referenciaNumero ?? 'sem vínculo'}.</p>
                    <p>{avaliacao.resultado.gestacional.classificacao ? `${avaliacao.resultado.gestacional.classificacao} da faixa da semana ${avaliacao.resultado.gestacional.semanaCurva}` : 'Sem classificação gestacional'}.</p>
                    {avaliacao.resultado.gestacional.motivos.map(m => <p key={m}>{motivoGestacional(m)}</p>)}
                    <p>Fonte: {fonteGestacional(avaliacao.resultado.gestacional.source_id)}. Idade gestacional: {avaliacao.resultado.gestacional.contexto?.semanas ?? '—'}s {avaliacao.resultado.gestacional.contexto?.dias ?? 0}d.</p>
                  </div> : null}
                  {podeGerenciar ? (
                    <fieldset className="mt-3 grid gap-2 rounded-md border border-linha p-3">
                      <legend className="px-1 text-xs font-medium text-tinta">Compartilhamento no progresso</legend>
                      {OPCOES_METRICAS_PORTAL.map((metrica) => (
                        <label key={metrica.id} className="flex items-center gap-2 text-xs text-texto-suave">
                          <input type="checkbox" checked={(avaliacao.metricasCompartilhadasPortal ?? []).includes(metrica.id)}
                            onChange={(evento) => {
                              const atuais = avaliacao.metricasCompartilhadasPortal ?? [];
                              const novas = evento.target.checked ? [...atuais, metrica.id] : atuais.filter((id) => id !== metrica.id);
                              void alterarCompartilhamento(avaliacao.id, novas);
                            }} />
                          {metrica.rotulo}
                        </label>
                      ))}
                    </fieldset>
                  ) : null}

                  <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-3 lg:grid-cols-4">
                    <div>
                      <dt className="text-xs text-texto-suave">Peso</dt>
                      <dd>{formatar(avaliacao.medidas.pesoKg)} kg</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-texto-suave">IMC</dt>
                      <dd>
                        {formatar(avaliacao.resultado.imc, 2)}
                        {avaliacao.resultado.classificacaoImc
                          ? ` - ${ROTULO_CLASSIFICACAO[avaliacao.resultado.classificacaoImc] ?? avaliacao.resultado.classificacaoImc}`
                          : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-texto-suave">RCQ</dt>
                      <dd>
                        {formatar(avaliacao.resultado.rcq, 2)}
                        {avaliacao.resultado.classificacaoRcq
                          ? ` - ${ROTULO_CLASSIFICACAO[avaliacao.resultado.classificacaoRcq] ?? avaliacao.resultado.classificacaoRcq}`
                          : ''}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-texto-suave">Gordura corporal</dt>
                      <dd>{formatar(avaliacao.resultado.percentualGordura)}%</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-texto-suave">Massa gorda</dt>
                      <dd>{formatar(avaliacao.resultado.massaGordaKg)} kg</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-texto-suave">Massa magra</dt>
                      <dd>{formatar(avaliacao.resultado.massaMagraKg)} kg</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-texto-suave">Cintura</dt>
                      <dd>
                        {formatar(avaliacao.resultado.circunferenciaCinturaCm)} cm
                        {avaliacao.resultado.classificacaoCircunferenciaCintura
                          ? ` - ${ROTULO_CLASSIFICACAO[avaliacao.resultado.classificacaoCircunferenciaCintura] ?? ''}`
                          : ''}
                      </dd>
                    </div>
                  </dl>

                  {avaliacao.formulaAplicada ? (
                    <details className="mt-2 text-xs text-texto-suave">
                      <summary className="cursor-pointer">Equacao usada nesta avaliação</summary>
                      <p className="mt-1">{avaliacao.formulaAplicada}</p>
                    </details>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-texto-suave">
              Nenhuma avaliação registrada. A primeira já mostra IMC e classificação; a segunda passa a mostrar
              variacao e curva.
            </p>
          )}
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}
