'use client';

import { useId, useMemo, useState } from 'react';

/**
 * Grafico de linha de serie unica, em SVG inline.
 *
 * Serie unica de proposito: a paleta categorica dos tokens da Fase 202 reprova
 * no teste de daltonismo (sucesso x alerta ficam com dE 4,7 sob protanopia), e
 * cores de status sao reservadas para estado, nao para identidade de serie.
 * Comparar metricas se faz trocando a metrica, nao empilhando linhas — e assim
 * tambem se evita o eixo duplo, que peso (kg) e percentual exigiriam.
 */

export interface PontoEvolucao {
  /** Data civil AAAA-MM-DD. */
  data: string;
  valor: number;
}

interface GraficoEvolucaoProps {
  pontos: PontoEvolucao[];
  rotulo: string;
  unidade: string;
  /** Casas decimais na exibicao. */
  casas?: number;
  descricao?: string;
}

const COR_SERIE = '#247BA0'; // token `primaria` da Fase 202
const LARGURA = 640;
const ALTURA = 240;
const MARGEM = { topo: 16, direita: 64, baixo: 32, esquerda: 48 };

function formatarData(data: string) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano.slice(2)}`;
}

function formatarValor(valor: number, casas: number) {
  return valor.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Ticks em numeros redondos, para o eixo carregar os valores que nao rotulei. */
function ticksArredondados(minimo: number, maximo: number, quantidade = 4): number[] {
  const bruto = (maximo - minimo) / quantidade;
  const magnitude = 10 ** Math.floor(Math.log10(bruto || 1));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((p) => p >= bruto) ?? magnitude * 10;
  const inicio = Math.floor(minimo / passo) * passo;
  const ticks: number[] = [];
  for (let valor = inicio; valor <= maximo + passo / 2; valor += passo) ticks.push(Number(valor.toFixed(6)));
  return ticks;
}

export function GraficoEvolucao({ pontos, rotulo, unidade, casas = 1, descricao }: GraficoEvolucaoProps) {
  const idGradiente = useId();
  const [indiceFoco, setIndiceFoco] = useState<number | null>(null);

  const serie = useMemo(() => [...pontos].sort((a, b) => a.data.localeCompare(b.data)), [pontos]);

  const geometria = useMemo(() => {
    if (!serie.length) return null;

    const tempos = serie.map((ponto) => new Date(`${ponto.data}T00:00:00.000Z`).getTime());
    const valores = serie.map((ponto) => ponto.valor);
    const tempoMin = Math.min(...tempos);
    const tempoMax = Math.max(...tempos);

    // Serie plana ou de ponto unico ainda precisa de dominio com altura.
    const bruto = { minimo: Math.min(...valores), maximo: Math.max(...valores) };
    const folga = (bruto.maximo - bruto.minimo || Math.abs(bruto.maximo) * 0.1 || 1) * 0.15;
    const valorMin = bruto.minimo - folga;
    const valorMax = bruto.maximo + folga;

    const largura = LARGURA - MARGEM.esquerda - MARGEM.direita;
    const altura = ALTURA - MARGEM.topo - MARGEM.baixo;
    const x = (tempo: number) =>
      MARGEM.esquerda + (tempoMax === tempoMin ? largura / 2 : ((tempo - tempoMin) / (tempoMax - tempoMin)) * largura);
    const y = (valor: number) => MARGEM.topo + altura - ((valor - valorMin) / (valorMax - valorMin)) * altura;

    const coordenadas = serie.map((ponto, indice) => ({ ...ponto, cx: x(tempos[indice]), cy: y(ponto.valor) }));
    const linha = coordenadas.map((ponto) => `${ponto.cx},${ponto.cy}`).join(' ');
    const base = MARGEM.topo + altura;
    const area = `${MARGEM.esquerda},${base} ${linha} ${coordenadas[coordenadas.length - 1].cx},${base}`;

    return { coordenadas, linha, area, ticks: ticksArredondados(valorMin, valorMax).filter((t) => t >= valorMin && t <= valorMax), y, base };
  }, [serie]);

  if (!geometria) {
    return (
      <p className="rounded-md border border-linha bg-superficie p-4 text-sm text-texto-suave">
        Sem avaliações suficientes para desenhar a curva de {rotulo.toLowerCase()}.
      </p>
    );
  }

  const { coordenadas, linha, area, ticks, base } = geometria;
  const ultimo = coordenadas[coordenadas.length - 1];
  const foco = indiceFoco !== null ? coordenadas[indiceFoco] : null;

  return (
    <figure className="m-0 grid gap-2">
      <figcaption className="text-sm font-medium text-tinta">
        {rotulo} <span className="font-normal text-texto-suave">({unidade})</span>
      </figcaption>
      {descricao ? <p className="text-xs text-texto-suave">{descricao}</p> : null}

      <svg
        viewBox={`0 0 ${LARGURA} ${ALTURA}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Evolucao de ${rotulo} em ${unidade}. Os valores tambem estao na tabela abaixo do grafico.`}
      >
        <defs>
          <linearGradient id={idGradiente} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={COR_SERIE} stopOpacity="0.16" />
            <stop offset="100%" stopColor={COR_SERIE} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Grade recessiva: 1px solida, um passo fora da superficie. */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={MARGEM.esquerda}
              x2={LARGURA - MARGEM.direita}
              y1={geometria.y(tick)}
              y2={geometria.y(tick)}
              stroke="#d9dee8"
              strokeWidth="1"
            />
            <text x={MARGEM.esquerda - 8} y={geometria.y(tick) + 4} textAnchor="end" fontSize="11" fill="#596273">
              {formatarValor(tick, casas)}
            </text>
          </g>
        ))}

        {coordenadas.length > 1 ? <polygon points={area} fill={`url(#${idGradiente})`} /> : null}
        {coordenadas.length > 1 ? (
          <polyline
            points={linha}
            fill="none"
            stroke={COR_SERIE}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ) : null}

        {coordenadas.map((ponto, indice) => (
          <g key={ponto.data}>
            {/* Anel na cor da superficie mantem o marcador legivel sobre a linha. */}
            <circle cx={ponto.cx} cy={ponto.cy} r="5" fill="#ffffff" />
            <circle cx={ponto.cx} cy={ponto.cy} r="4" fill={COR_SERIE} />
            {/*
              Alvo de toque maior que o marcador, so para hover de mouse: um
              circle focalizavel (tabIndex/role="button") aqui dentro violaria
              a regra axe-core nested-interactive, porque role="img" no <svg>
              pai exige que nao haja descendente interativo/focalizavel. Os
              mesmos dados ja estao 100% acessiveis via teclado/leitor de tela
              na tabela "Ver valores em tabela" abaixo, entao este alvo de
              toque nao precisa ser focalizavel para nao perder cobertura.
            */}
            <circle
              cx={ponto.cx}
              cy={ponto.cy}
              r="16"
              fill="transparent"
              onMouseEnter={() => setIndiceFoco(indice)}
              onMouseLeave={() => setIndiceFoco(null)}
            />
            <text x={ponto.cx} y={base + 18} textAnchor="middle" fontSize="11" fill="#596273">
              {coordenadas.length <= 6 || indice === 0 || indice === coordenadas.length - 1
                ? formatarData(ponto.data)
                : ''}
            </text>
          </g>
        ))}

        {/* Rotulo direto so no ultimo ponto: numero em todo ponto vira ruido. */}
        <text x={ultimo.cx + 10} y={ultimo.cy + 4} fontSize="12" fontWeight="600" fill="#1F2937">
          {formatarValor(ultimo.valor, casas)}
        </text>

        {foco ? (
          <g pointerEvents="none">
            <line x1={foco.cx} x2={foco.cx} y1={MARGEM.topo} y2={base} stroke="#d9dee8" strokeWidth="1" />
            <circle cx={foco.cx} cy={foco.cy} r="7" fill="none" stroke={COR_SERIE} strokeWidth="2" />
          </g>
        ) : null}
      </svg>

      {foco ? (
        <p aria-live="polite" className="text-sm text-tinta">
          {formatarData(foco.data)}: <strong>{formatarValor(foco.valor, casas)}</strong> {unidade}
        </p>
      ) : null}

      <details className="text-sm">
        <summary className="cursor-pointer text-texto-suave">Ver valores em tabela</summary>
        <table className="mt-2 w-full border-collapse text-left">
          <caption className="sr-only">
            {rotulo} em {unidade}, por data de avaliação
          </caption>
          <thead>
            <tr>
              <th scope="col" className="border-b border-linha py-1 pr-4 font-medium text-texto-suave">
                Data
              </th>
              <th scope="col" className="border-b border-linha py-1 font-medium text-texto-suave">
                {rotulo} ({unidade})
              </th>
            </tr>
          </thead>
          <tbody>
            {[...coordenadas].reverse().map((ponto) => (
              <tr key={ponto.data}>
                <td className="border-b border-linha py-1 pr-4">{formatarData(ponto.data)}</td>
                <td className="border-b border-linha py-1">{formatarValor(ponto.valor, casas)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
