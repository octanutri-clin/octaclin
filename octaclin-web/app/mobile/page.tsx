import { ConsoleShell } from '@/components/app/console-shell';
import { PainelMobile } from '@/components/mobile/painel-mobile';

export default function MobilePage() {
  return (
    <ConsoleShell titulo="Mobile" subtitulo="App e sincronizacao">
      <PainelMobile />
    </ConsoleShell>
  );
}
