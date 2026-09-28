import { ConsoleShell } from '@/components/app/console-shell';
import { FilaRevisaoFormularios } from '@/components/questionarios/fila-revisao-formularios';

export default async function RevisoesQuestionariosPage({ searchParams }: { searchParams: Promise<{ envio?: string }> }) {
  const { envio } = await searchParams;
  return (
    <ConsoleShell titulo="Revisão de formulários" subtitulo="Leia cada resposta antes de concluir a revisão">
      <FilaRevisaoFormularios envioInicial={envio} />
    </ConsoleShell>
  );
}
