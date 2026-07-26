import { FormularioPacientePublico } from '@/components/formularios/formulario-paciente-publico';

export default async function FormularioPublicoPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params;
  return <FormularioPacientePublico token={params.token} />;
}
