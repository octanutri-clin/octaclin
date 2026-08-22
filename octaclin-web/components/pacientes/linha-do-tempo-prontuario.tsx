import {
  BadgeDollarSign,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileText,
  FlaskConical,
  ImageIcon,
  MessageSquareText,
  Paperclip,
  Ruler,
  Stethoscope,
  Utensils
} from 'lucide-react';
import { EstadoVazio } from '@/components/ui/feedback';
import type { ProfissionalResumo } from '@/lib/cadastros-api';
import type { EventoProntuarioPacienteApi } from '@/lib/prontuario-api';

export function formatarDataHora(valor?: string) {
  if (!valor) return '-';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
}

function rotuloTipo(tipo: EventoProntuarioPacienteApi['tipo']) {
  const rotulos: Record<EventoProntuarioPacienteApi['tipo'], string> = {
    consulta: 'Consulta',
    formulario: 'Formulário',
    resposta_formulario: 'Resposta',
    checkin_rapido: 'Check-in rápido',
    mensagem: 'Mensagem',
    evolucao_clinica: 'Evolução',
    tarefa_acompanhamento: 'Tarefa',
    plano_alimentar_publicado: 'Plano alimentar',
    avaliacao_antropometrica: 'Antropometria',
    documento_emitido: 'Documento',
    anexo_confirmado: 'Anexo',
    exame_laboratorial: 'Exame laboratorial',
    evolucao_fotografica: 'Evolução fotográfica',
    evento_financeiro: 'Financeiro'
  };
  return rotulos[tipo];
}

export function classeStatus(status?: string) {
  if (status === 'falhou' || status === 'cancelada') return 'bg-perigo-suave text-perigo';
  if (status === 'respondido' || status === 'finalizado' || status === 'agendada') return 'bg-sucesso-suave text-sucesso';
  return 'bg-superficie-hover text-texto-suave';
}

function iconeEvento(tipo: EventoProntuarioPacienteApi['tipo']) {
  if (tipo === 'consulta') return CalendarDays;
  if (tipo === 'mensagem') return MessageSquareText;
  if (tipo === 'evolucao_clinica') return Stethoscope;
  if (tipo === 'tarefa_acompanhamento') return CheckSquare;
  if (tipo === 'plano_alimentar_publicado') return Utensils;
  if (tipo === 'avaliacao_antropometrica') return Ruler;
  if (tipo === 'documento_emitido') return FileText;
  if (tipo === 'anexo_confirmado') return Paperclip;
  if (tipo === 'exame_laboratorial') return FlaskConical;
  if (tipo === 'evolucao_fotografica') return ImageIcon;
  if (tipo === 'evento_financeiro') return BadgeDollarSign;
  return ClipboardList;
}

function autoriaEvento(evento: EventoProntuarioPacienteApi, profissionais: ProfissionalResumo[]) {
  const autor = profissionais.find((profissional) => profissional.usuarioId === evento.autorUsuarioId);
  const responsavel = profissionais.find((profissional) => profissional.id === evento.responsavelId);
  const origens: Record<string, string> = {
    Formularios: 'Formulários',
    'Evolucao fotografica': 'Evolução fotográfica',
    Prontuario: 'Prontuário',
    Comunicacoes: 'Comunicações'
  };
  const partes = evento.origem ? [`Origem: ${origens[evento.origem] ?? evento.origem}`] : [];
  if (autor) partes.push(`Autor: ${autor.nome}`);
  else if (evento.autorUsuarioId) {
    const autoriaDoPaciente = evento.tipo === 'resposta_formulario'
      || evento.tipo === 'checkin_rapido'
      || (evento.tipo === 'mensagem' && evento.status === 'recebido');
    partes.push(autoriaDoPaciente ? 'Autor: paciente' : 'Autor: equipe clínica');
  }
  if (responsavel && responsavel.id !== autor?.id) partes.push(`Responsável: ${responsavel.nome}`);
  return partes.join(' - ');
}

export function LinhaDoTempoProntuario({
  eventos,
  aoAbrirEvento,
  profissionais = []
}: {
  eventos: EventoProntuarioPacienteApi[];
  aoAbrirEvento?: (evento: EventoProntuarioPacienteApi) => void;
  profissionais?: ProfissionalResumo[];
}) {
  if (!eventos.length) {
    return <EstadoVazio titulo="Sem eventos no prontuário" descricao="Agenda, formulários, respostas e mensagens aparecerão aqui." />;
  }

  return (
    <div className="grid gap-3">
      {eventos.map((evento) => {
        const Icone = iconeEvento(evento.tipo);
        const autoria = autoriaEvento(evento, profissionais);
        return (
          <article key={`${evento.tipo}-${evento.id}`} className="grid gap-2 rounded-md border border-linha bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primaria-suave text-primaria">
                  <Icone size={18} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-texto-suave">{rotuloTipo(evento.tipo)}</p>
                  <h3 className="mt-1 break-words text-sm font-semibold text-tinta">{evento.titulo}</h3>
                  {evento.descricao ? <p className="mt-1 break-words text-sm text-texto-suave">{evento.descricao}</p> : null}
                  {autoria ? <p className="mt-1 break-words text-xs text-texto-suave">{autoria}</p> : null}
                </div>
              </div>
              <div className="shrink-0 text-left sm:text-right">
                <p className="text-xs text-texto-suave">{formatarDataHora(evento.data)}</p>
                {evento.status ? (
                  <span className={`mt-2 inline-flex rounded-md px-2 py-1 text-xs font-semibold ${classeStatus(evento.status)}`}>
                    {evento.status}
                  </span>
                ) : null}
                {aoAbrirEvento ? (
                  <button
                    type="button"
                    onClick={() => aoAbrirEvento(evento)}
                    className="mt-2 block text-xs font-semibold text-primaria hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primaria"
                    aria-label={`Abrir detalhe de ${evento.titulo}`}
                  >
                    Abrir detalhe
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
