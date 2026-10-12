import type { Metadata } from 'next';
import Link from 'next/link';
import { PortalShell } from '@/components/app/portal-shell';
import { ConfiguracaoPiloto } from '@/components/gamificacao/configuracao-piloto';

export const metadata: Metadata = { title: 'Disponibilidade do piloto | OctaClin' };

export default function ConfiguracaoGamificacaoClientePage() {
  return (
    <PortalShell variante="tabs" titulo="Disponibilidade do piloto" subtitulo="Configurações da clínica" navegacao={[]} navLabel="Navegação do cliente" maxWidth="1180px" acoes={<Link className="text-sm font-semibold text-primaria underline" href="/cliente">Voltar ao portal do cliente</Link>}>
      <ConfiguracaoPiloto />
    </PortalShell>
  );
}
