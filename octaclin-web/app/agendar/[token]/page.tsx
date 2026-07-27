import { FormularioAgendamentoPublico } from '@/components/agenda/formulario-agendamento-publico';

export default async function AgendarPublicoPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  return <FormularioAgendamentoPublico token={params.token} />;
}
