'use client';

import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { PortalShell } from '@/components/app/portal-shell';
import { Abas } from '@/components/ui/abas';
import { ModalConfirmacao } from '@/components/ui/modal';
import { AreaEquipeCliente } from './area-equipe-cliente';
import { AreaPerfilCliente } from './area-perfil-cliente';
import { AreasConfiguracaoCliente } from './areas-configuracao-cliente';
import { AreaAssinaturaUsoCliente, AreaVisaoGeralCliente } from './areas-visao-assinatura';
import { AreaPortalCliente } from './portal-cliente-dominio';
import { usePortalCliente } from './use-portal-cliente';

export function PortalCliente() {
  const portal = usePortalCliente();
  const {
    areaAtiva,
    setAreaAtiva,
    resumo,
    erro,
    carregando,
    podeLerFinanceiro,
    confirmacaoUsuario,
    setConfirmacaoUsuario,
    desativandoUsuarioId,
    acaoConviteUsuarioId,
    confirmarAcaoUsuario
  } = portal;

  const acoesCabecalho = (
    <div className="inline-flex w-fit items-center gap-2 rounded-md border border-linha bg-superficie px-3 py-2 text-sm font-medium text-texto-forte">
      <ShieldCheck className="h-4 w-4 text-primaria" />
      Acesso profissional separado
    </div>
  );

  const descricaoCabecalho = (
    <>
      <p>Área administrativa da conta, separada das rotinas assistenciais e dos acessos dos pacientes.</p>
      {resumo ? <p className="mt-2 break-words font-medium text-texto-forte">{resumo.conta.nome}</p> : null}
    </>
  );

  return (
    <PortalShell
      variante="tabs"
      titulo="Portal do cliente"
      subtitulo="Conta OctaClin"
      descricao={descricaoCabecalho}
      navegacao={[]}
      navLabel="Navegacao do cliente"
      acoes={acoesCabecalho}
      maxWidth="1180px"
    >
      <section className="grid gap-4" aria-busy={carregando}>
        {erro ? (
          <section className="flex items-start gap-3 rounded-lg border border-perigo-borda bg-white p-4" aria-live="polite">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-perigo-suave text-perigo">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">Conta indisponível</h2>
              <p className="mt-1 break-words text-sm text-texto-suave">{erro}</p>
            </div>
          </section>
        ) : null}

        <Abas
          identificador="conta-cliente"
          rotulo="Áreas da conta"
          abas={[
            { id: 'ativacao', rotulo: 'Ativação' },
            { id: 'assinatura', rotulo: 'Assinatura' },
            { id: 'consumo', rotulo: 'Consumo' },
            ...(podeLerFinanceiro ? [{ id: 'financeiro', rotulo: 'Financeiro' }] : []),
            { id: 'equipe', rotulo: 'Equipe' },
            { id: 'preferencias', rotulo: 'Preferências' },
            { id: 'marca', rotulo: 'Marca' },
            { id: 'documentos', rotulo: 'Documentos' },
            { id: 'integracoes', rotulo: 'Integrações' },
            { id: 'fiscal', rotulo: 'Dados fiscais' }
          ]}
          ativaId={areaAtiva}
          aoMudar={(id) => setAreaAtiva(id as AreaPortalCliente)}
        />

        <AreaVisaoGeralCliente portal={portal} />
        <AreaAssinaturaUsoCliente portal={portal} />
        <AreaEquipeCliente portal={portal} />
        <AreasConfiguracaoCliente portal={portal} />
        <AreaPerfilCliente portal={portal} />
      </section>

      <ModalConfirmacao
        aberto={confirmacaoUsuario !== null}
        titulo={confirmacaoUsuario?.tipo === 'revogar' ? 'Revogar convite' : 'Desativar usuário'}
        mensagem={
          confirmacaoUsuario
            ? confirmacaoUsuario.tipo === 'revogar'
              ? `Revogar o convite de ${confirmacaoUsuario.email}?`
              : `Desativar o acesso de ${confirmacaoUsuario.email}?`
            : ''
        }
        rotuloConfirmar={confirmacaoUsuario?.tipo === 'revogar' ? 'Revogar' : 'Desativar'}
        confirmando={Boolean(desativandoUsuarioId) || Boolean(acaoConviteUsuarioId)}
        aoConfirmar={() => void confirmarAcaoUsuario()}
        aoCancelar={() => setConfirmacaoUsuario(null)}
      />
    </PortalShell>
  );
}
