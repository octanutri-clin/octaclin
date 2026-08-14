'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { BarraCarregamento } from '@/components/ui/feedback';
import { GraficoEvolucao, PontoEvolucao } from '@/components/ui/grafico-evolucao';
import { METRICAS_ANTROPOMETRICAS } from './metricas-antropometricas';
import { useRequisicaoCancelavel } from '@/lib/hooks';
import {
  ProtocoloComposicao,
  SerieAntropometricaApi,
  SexoBiologico,
  excluirAvaliacaoAntropometrica,
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
  peso_fora_da_faixa: 'Peso fora da faixa aceita.',
  altura_fora_da_faixa: 'Altura fora da faixa aceita.',
  imc_fora_da_faixa_plausivel: 'Peso e altura juntos dao um IMC impossivel. Confira os dois.',
  imc_sem_classificacao_idade_ausente: 'IMC calculado, mas sem classificacao: falta a data de nascimento no cadastro.',
  imc_sem_classificacao_menor_de_20_exige_escore_z:
    'Menor de 20 anos: o IMC nao e classificado por corte de adulto, exige escore-z da OMS.',
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
  cintura: string;
  quadril: string;
  dobras: Record<string, string>;
}

function formularioInicial(): FormularioAvaliacao {
  return {
    avaliadaEm: new Date().toISOString().slice(0, 10),
    protocolo: 'nenhum',
    sexo: '',
    pesoKg: '',
    alturaCm: '',
    cintura: '',
    quadril: '',
    dobras: {}
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
}

export function AbaAntropometria({ pacienteId, podeGerenciar }: AbaAntropometriaProps) {
  const [serie, setSerie] = useState<SerieAntropometricaApi | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<FormularioAvaliacao>(formularioInicial);
  const [metricaId, setMetricaId] = useState('peso');
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
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar avaliacoes.');
    } finally {
      if (ehAtual()) setCarregando(false);
    }
  }, [iniciarRequisicao, pacienteId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

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

    if (formulario.protocolo !== 'nenhum' && !formulario.sexo) {
      setErro('Informe o sexo: os protocolos de composicao corporal usam equacoes diferentes por sexo.');
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

      await registrarAvaliacaoAntropometrica(pacienteId, {
        avaliadaEm: formulario.avaliadaEm,
        protocolo: formulario.protocolo,
        sexo: formulario.sexo || undefined,
        pesoKg: numero(formulario.pesoKg),
        alturaCm: numero(formulario.alturaCm),
        ...(Object.keys(circunferencias).length ? { circunferencias } : {}),
        ...(Object.keys(dobras).length ? { dobras } : {})
      });
      setFormulario((atual) => ({ ...formularioInicial(), protocolo: atual.protocolo, sexo: atual.sexo }));
      setSucesso('Avaliacao registrada.');
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao registrar avaliacao.');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(avaliacaoId: string) {
    setErro(null);
    setSucesso(null);
    try {
      await excluirAvaliacaoAntropometrica(pacienteId, avaliacaoId);
      setSucesso('Avaliacao removida da serie.');
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao remover avaliacao.');
    }
  }

  const ultima = serie?.avaliacoes[0];

  return (
    <div className="grid gap-4">
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
          <CartaoTitulo>Evolucao das medidas</CartaoTitulo>
          <div className="flex items-center gap-3">
            <BarraCarregamento visivel={carregando} rotulo="Carregando avaliacoes" />
            <label className="flex items-center gap-2">
              <Rotulo className="whitespace-nowrap">Metrica</Rotulo>
              <Selecao
                aria-label="Metrica do grafico"
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
            descricao="Uma metrica por vez: peso e percentual tem escalas diferentes e nao dividem eixo."
          />
        </CartaoConteudo>
      </Cartao>

      {serie?.deltaUltimas.length ? (
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Variacao desde a avaliacao anterior</CartaoTitulo>
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

      {podeGerenciar ? (
        <Cartao>
          <CartaoCabecalho>
            <CartaoTitulo>Nova avaliacao</CartaoTitulo>
          </CartaoCabecalho>
          <CartaoConteudo>
            <form onSubmit={salvar} className="grid gap-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="grid gap-1">
                  <Rotulo>Data</Rotulo>
                  <Campo
                    type="date"
                    value={formulario.avaliadaEm}
                    onChange={(evento) => setFormulario((atual) => ({ ...atual, avaliadaEm: evento.target.value }))}
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
                    <option value="">Nao informado</option>
                    <option value="feminino">Feminino</option>
                    <option value="masculino">Masculino</option>
                  </Selecao>
                </label>
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
                  <Rotulo>Protocolo de composicao</Rotulo>
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
                  Informe o sexo para ver quais dobras este protocolo exige: as equacoes e os sitios mudam por sexo.
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

              <div className="flex justify-end">
                <Botao type="submit" variante="primario" disabled={salvando}>
                  {salvando ? 'Registrando' : 'Registrar avaliacao'}
                </Botao>
              </div>
            </form>
          </CartaoConteudo>
        </Cartao>
      ) : null}

      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo>Avaliacoes registradas</CartaoTitulo>
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
                      <summary className="cursor-pointer">Equacao usada nesta avaliacao</summary>
                      <p className="mt-1">{avaliacao.formulaAplicada}</p>
                    </details>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-texto-suave">
              Nenhuma avaliacao registrada. A primeira ja mostra IMC e classificacao; a segunda passa a mostrar
              variacao e curva.
            </p>
          )}
        </CartaoConteudo>
      </Cartao>
    </div>
  );
}
