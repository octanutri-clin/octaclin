'use client';

import { HeartPulse } from 'lucide-react';
import { PortalShell } from '@/components/app/portal-shell';
import { GamificacaoPilotoPortal } from '@/components/portal/gamificacao-piloto-portal';

const navegacao = [
  { href: '/portal', rotulo: 'Início' }, { href: '/portal/agenda', rotulo: 'Agenda' },
  { href: '/portal/checkins', rotulo: 'Registro de hábitos' }, { href: '/portal/plano', rotulo: 'Plano' },
  { href: '/portal/receitas', rotulo: 'Receitas' }, { href: '/portal/formularios', rotulo: 'Formulários' },
  { href: '/portal/mensagens', rotulo: 'Mensagens' }, { href: '/portal/perfil', rotulo: 'Perfil' },
  { href: '/portal/gamificacao', rotulo: 'Conquistas e círculos' }, { href: '/portal/privacidade', rotulo: 'Privacidade' },
  { href: '/portal/mais', rotulo: 'Mais' }
];

export default function PaginaGamificacaoPortal() {
  return <PortalShell variante="tabs" titulo="Conquistas e círculos" subtitulo="Portal do paciente" marca={{icone:HeartPulse,rotulo:'OctaClin',subrotulo:'Portal do paciente'}} navegacao={navegacao} navegacaoMobile={[
    {href:'/portal',rotulo:'Início',icone:HeartPulse},{href:'/portal/plano',rotulo:'Plano'},
    {href:'/portal/gamificacao',rotulo:'Conquistas'},{href:'/portal/mais',rotulo:'Mais'}
  ]} navLabel="Navegação do portal" navLabelMobile="Navegação mobile do portal" maxWidth="72rem">
    <GamificacaoPilotoPortal />
  </PortalShell>;
}
