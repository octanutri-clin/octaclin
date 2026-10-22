'use client';

import { RefreshCcw } from 'lucide-react';
import { Abas } from '@/components/ui/abas';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoConteudo } from '@/components/ui/cartao';
import { AlertaOperacional, AlertaSucesso, BarraCarregamento } from '@/components/ui/feedback';
import { AreaAuditoria } from './area-auditoria';
import { AreaComunicacoes } from './area-comunicacoes';
import { AreaFilas } from './area-filas';
import { AreaIncidentes } from './area-incidentes';
import { AreaLgpd } from './area-lgpd';
import { AreaOnboarding } from './area-onboarding';
import { AreaSaude } from './area-saude';
import { AreaRollout } from './area-rollout';
import { BibliotecaGruposSubstituicoes } from '@/components/pacientes/biblioteca-grupos-substituicoes';
import { AreaOperacoes, usePainelOperacoes } from './use-painel-operacoes';

const areasOperacoes = [
  { id: 'onboarding', rotulo: 'Onboarding' },
  { id: 'saude', rotulo: 'Saude' },
  { id: 'rollout', rotulo: 'Rollout' },
  { id: 'incidentes', rotulo: 'Incidentes' },
  { id: 'comunicacoes', rotulo: 'Comunicações' },
  { id: 'lgpd', rotulo: 'LGPD' },
  { id: 'auditoria', rotulo: 'Auditoria' },
  { id: 'filas', rotulo: 'Filas' }
];

export function PainelOperacoes() {
  const controlador = usePainelOperacoes();
  const {
    sessao,
    erro,
    sucesso,
    carregando,
    carregandoAuditoria,
    carregandoAssinatura,
    carregandoLgpd,
    carregandoDetalheLgpd,
    reprocessandoComunicacaoId,
    preparandoRespostaProtocolo,
    programandoRetencao,
    areaAtiva,
    setAreaAtiva,
    carregar,
    encerrarSessao
  } = controlador;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <Cartao>
        <CartaoConteudo className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold">{sessao?.email ?? 'Carregando sessão'}</p>
            <p className="mt-1 text-xs text-texto-suave">
              {sessao ? `${sessao.tenantSlug} em ${sessao.apiUrl}` : 'Validando acesso operacional'}
            </p>
          </div>
          <Botao onClick={encerrarSessao} variante="fantasma">
            Sair
          </Botao>
          <Botao variante="primario" onClick={carregar} disabled={carregando}>
            <RefreshCcw size={16} />
            {carregando ? 'Atualizando' : 'Atualizar'}
          </Botao>
        </CartaoConteudo>
      </Cartao>

      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {sucesso ? <AlertaSucesso mensagem={sucesso} /> : null}
      <BarraCarregamento
        visivel={
          carregando ||
          carregandoAuditoria ||
          carregandoAssinatura ||
          carregandoLgpd ||
          carregandoDetalheLgpd ||
          Boolean(reprocessandoComunicacaoId) ||
          Boolean(preparandoRespostaProtocolo) ||
          programandoRetencao
        }
      />

      <Abas
        identificador="operacoes"
        abas={sessao?.papel === 'SuperAdmin' && sessao.permissoes.includes('grupos_substituicoes.administrar')
          ? [...areasOperacoes, { id: 'grupos', rotulo: 'Grupos alimentares' }]
          : areasOperacoes}
        ativaId={areaAtiva}
        aoMudar={(id) => setAreaAtiva(id as AreaOperacoes)}
        rotulo="Áreas de operações"
      />

      <AreaSaude controlador={controlador} />
      <AreaRollout controlador={controlador} />
      <AreaOnboarding ativa={areaAtiva === 'onboarding'} />
      <AreaIncidentes controlador={controlador} />
      <AreaComunicacoes controlador={controlador} />
      <AreaFilas controlador={controlador} />
      <AreaLgpd controlador={controlador} />
      <AreaAuditoria controlador={controlador} />
      {areaAtiva === 'grupos' && sessao?.papel === 'SuperAdmin' && sessao.permissoes.includes('grupos_substituicoes.administrar')
        ? <BibliotecaGruposSubstituicoes administracao /> : null}
    </div>
  );
}
