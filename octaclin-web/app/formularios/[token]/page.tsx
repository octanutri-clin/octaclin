import { FormularioPacientePublico } from '@/components/formularios/formulario-paciente-publico';

export default function FormularioPublicoPage({ params }: { params: { token: string } }) {
  return <FormularioPacientePublico token={params.token} />;
}
