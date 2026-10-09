import { redirect } from 'next/navigation';
import { PreferenciasNotificacoes } from '@/components/conta/preferencias-notificacoes';
import { ConsoleShell } from '@/components/app/console-shell';
import { sessaoPossuiPermissao } from '@/lib/server/permissoes-bff';
import { ErroSessaoAusente, obterSessaoValidaBff } from '@/lib/server/sessao-bff';

export const metadata = { title: 'Notificações | OctaClin' };

export default async function PaginaPreferenciasNotificacoes() {
  let sessao;
  try { sessao = await obterSessaoValidaBff(); } catch (erro) {
    if (erro instanceof ErroSessaoAusente) redirect('/login');
    throw erro;
  }
  if (!sessaoPossuiPermissao(sessao, 'console.acessar')) {
    redirect(sessao.papel === 'Patient' ? '/portal' : sessao.papel === 'Client' ? '/cliente' : '/login');
  }

  return (
    <ConsoleShell titulo="Preferências de notificações" subtitulo="Escolha como receber atualizações opcionais da sua conta">
      <div className="mx-auto w-full max-w-3xl rounded-lg border border-borda bg-superficie p-4 sm:p-6">
        <PreferenciasNotificacoes />
      </div>
    </ConsoleShell>
  );
}
