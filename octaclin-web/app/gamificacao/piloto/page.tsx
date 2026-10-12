import Link from 'next/link';
import { ConsoleShell } from '@/components/app/console-shell';
import { ConfiguracaoPiloto } from '@/components/gamificacao/configuracao-piloto';
import { PainelProfissionalPiloto } from '@/components/gamificacao/painel-profissional-piloto';

export default function PaginaPilotoGamificacao() {
  return (
    <ConsoleShell titulo="Conquistas e círculos" subtitulo="Piloto privado para adultos, com aceite e saída a qualquer momento" acoes={<Link href="/gamificacao" className="text-sm font-semibold text-primaria underline">Abrir recursos atuais</Link>}>
      <div className="grid gap-6">
        <ConfiguracaoPiloto />
        <PainelProfissionalPiloto />
      </div>
    </ConsoleShell>
  );
}
