import { NextResponse } from 'next/server';
import { normalizarApiUrlBff } from '@/lib/server/sessao-bff';

function obterApiUrlPublica() {
  return normalizarApiUrlBff(process.env.OCTACLIN_BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001');
}

function chaveDia(data: Date, timeZone: string) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(data);

  const ano = partes.find((parte) => parte.type === 'year')?.value ?? '0000';
  const mes = partes.find((parte) => parte.type === 'month')?.value ?? '00';
  const dia = partes.find((parte) => parte.type === 'day')?.value ?? '00';
  return `${ano}-${mes}-${dia}`;
}

function rotuloDia(data: Date, timeZone: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(data);
}

function rotuloHora(data: Date, timeZone: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit'
  }).format(data);
}

function agruparHorarios(horariosLivres: string[], timeZone: string) {
  const grupos = new Map<string, { data: string; rotulo: string; horarios: { inicioEm: string; rotulo: string }[] }>();

  for (const horarioLivre of horariosLivres) {
    const data = new Date(horarioLivre);
    if (Number.isNaN(data.getTime())) continue;

    const dataChave = chaveDia(data, timeZone);
    if (!grupos.has(dataChave)) {
      grupos.set(dataChave, {
        data: dataChave,
        rotulo: rotuloDia(data, timeZone),
        horarios: []
      });
    }

    grupos.get(dataChave)?.horarios.push({
      inicioEm: horarioLivre,
      rotulo: rotuloHora(data, timeZone)
    });
  }

  return [...grupos.values()];
}

export async function GET(_: Request, props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  const resposta = await fetch(`${obterApiUrlPublica()}/agendamentos-publicos/${encodeURIComponent(params.token)}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store'
  });

  const corpo = await resposta.text();
  if (!resposta.ok) {
    return new NextResponse(corpo, {
      status: resposta.status,
      headers: { 'Content-Type': resposta.headers.get('Content-Type') ?? 'application/json' }
    });
  }

  const agenda = JSON.parse(corpo) as {
    profissionalNome: string;
    timezone: string;
    duracaoMinutos: number;
    horariosLivres: string[];
  };

  return NextResponse.json({
    profissional: {
      nomeExibicao: agenda.profissionalNome
    },
    timezone: agenda.timezone,
    duracaoMinutos: agenda.duracaoMinutos,
    dias: agruparHorarios(agenda.horariosLivres, agenda.timezone)
  });
}
