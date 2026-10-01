import { ConsoleShell } from '@/components/app/console-shell';
import { EditorQuestionario } from '@/components/questionarios/editor-questionario';
import Link from 'next/link';

export default function QuestionariosPage() {
  return (
    <ConsoleShell titulo="Editor de Questionários" subtitulo="Protocolos e retornos de avaliação">
      <div className="mb-4 flex flex-wrap gap-4 text-sm">
        <Link className="font-semibold text-primaria-forte underline" href="/questionarios/revisoes">Revisar formulários</Link>
        <Link className="font-semibold text-primaria-forte underline" href="/checkins/revisoes">Revisar registros de hábitos</Link>
      </div>
      <EditorQuestionario />
    </ConsoleShell>
  );
}
