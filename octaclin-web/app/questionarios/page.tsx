import { ConsoleShell } from '@/components/app/console-shell';
import { EditorQuestionario } from '@/components/questionarios/editor-questionario';

export default function QuestionariosPage() {
  return (
    <ConsoleShell titulo="Editor de Questionários" subtitulo="Protocolos e check-ins">
      <EditorQuestionario />
    </ConsoleShell>
  );
}
