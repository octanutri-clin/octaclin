'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Building2, CheckCircle2, Clock3, PauseCircle, PlayCircle, Plus, RefreshCcw } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Campo, Rotulo, Selecao } from '@/components/ui/campo';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { EtiquetaStatus, StatusEtiquetaConfig } from '@/components/ui/etiqueta';
import { AlertaOperacional, AlertaSucesso, BarraCarregamento, EstadoVazio } from '@/components/ui/feedback';
import { Modal } from '@/components/ui/modal';
import {
  AcaoCicloVidaTenant,
  DadosProvisionamentoTenant,
  StatusCicloVidaTenant,
  TenantOnboardingOperacional,
  atualizarCicloVidaTenant,
  listarTenantsOnboarding,
  provisionarTenant
} from '@/lib/onboarding-operacoes-api';

const estados: Record<StatusCicloVidaTenant, StatusEtiquetaConfig> = {
  ativo_assistido: { rotulo: 'Ativacao assistida', variante: 'primaria' },
  primeiro_uso_validado: { rotulo: 'Primeiro uso validado', variante: 'primaria' },
  acompanhamento_48h: { rotulo: 'Acompanhamento 48h', variante: 'alerta' },
  ativo: { rotulo: 'Ativo', variante: 'sucesso' },
  suspenso: { rotulo: 'Suspenso', variante: 'alerta' },
  encerramento_pendente: { rotulo: 'Encerramento pendente', variante: 'perigo' },
  encerrado: { rotulo: 'Encerrado', variante: 'neutra' }
};

const rotulosAcao: Record<AcaoCicloVidaTenant, string> = {
  marcar_primeiro_uso: 'Validar primeiro uso',
  iniciar_acompanhamento: 'Iniciar 48h',
  concluir_acompanhamento: 'Concluir ativacao',
  suspender: 'Suspender',
  reativar: 'Reativar',
  iniciar_encerramento: 'Preparar encerramento',
  encerrar: 'Encerrar definitivamente'
};

const formularioInicial: DadosProvisionamentoTenant = {
  referencia: '',
  nome: '',
  slug: '',
  emailProprietario: '',
  planoId: 'profissional',
  timezone: 'America/Sao_Paulo'
};

function acoesDisponiveis(status: StatusCicloVidaTenant): AcaoCicloVidaTenant[] {
  const fluxo: Partial<Record<StatusCicloVidaTenant, AcaoCicloVidaTenant>> = {
    ativo_assistido: 'marcar_primeiro_uso',
    primeiro_uso_validado: 'iniciar_acompanhamento',
    acompanhamento_48h: 'concluir_acompanhamento'
  };
  const acoes: AcaoCicloVidaTenant[] = [];
  if (fluxo[status]) acoes.push(fluxo[status]!);
  if (['ativo_assistido', 'primeiro_uso_validado', 'acompanhamento_48h', 'ativo'].includes(status)) acoes.push('suspender');
  if (status === 'suspenso') acoes.push('reativar');
  if (!['encerramento_pendente', 'encerrado'].includes(status)) acoes.push('iniciar_encerramento');
  if (status === 'encerramento_pendente') acoes.push('encerrar');
  return acoes;
}

function formatarData(valor: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor));
}

export function AreaOnboarding({ ativa }: { ativa: boolean }) {
  const [formulario, setFormulario] = useState(formularioInicial);
  const [tenants, setTenants] = useState<TenantOnboardingOperacional[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<{ tenant: TenantOnboardingOperacional; acao: AcaoCicloVidaTenant } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [exportacaoConfirmada, setExportacaoConfirmada] = useState(false);
  const [protocoloExportacao, setProtocoloExportacao] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await listarTenantsOnboarding();
      setTenants(resposta.itens);
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar clinicas.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (ativa) void carregar();
  }, [ativa, carregar]);

  const totais = useMemo(
    () => ({
      ativacao: tenants.filter((tenant) => ['ativo_assistido', 'primeiro_uso_validado', 'acompanhamento_48h'].includes(tenant.cicloVidaStatus)).length,
      ativos: tenants.filter((tenant) => tenant.cicloVidaStatus === 'ativo').length,
      suspensos: tenants.filter((tenant) => tenant.cicloVidaStatus === 'suspenso').length
    }),
    [tenants]
  );

  async function provisionar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const resultado = await provisionarTenant(formulario);
      setSucesso(
        resultado.reutilizado
          ? `Provisionamento ${resultado.provisionamentoReferencia} reutilizado sem duplicar a clinica.`
          : `Clinica ${resultado.nome} criada. Convite do proprietario: ${resultado.convite?.status ?? 'pendente'}.`
      );
      setFormulario(formularioInicial);
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao provisionar clinica.');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarAcao() {
    if (!confirmacao) return;
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      await atualizarCicloVidaTenant(confirmacao.tenant.id, {
        acao: confirmacao.acao,
        motivo: motivo.trim() || undefined,
        exportacaoConfirmada: confirmacao.acao === 'encerrar' ? exportacaoConfirmada : undefined,
        protocoloExportacao: confirmacao.acao === 'encerrar' ? protocoloExportacao.trim() : undefined
      });
      setSucesso(`${rotulosAcao[confirmacao.acao]} aplicado a ${confirmacao.tenant.nome}.`);
      fecharConfirmacao();
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao atualizar ciclo de vida.');
    } finally {
      setSalvando(false);
    }
  }

  function abrirConfirmacao(tenant: TenantOnboardingOperacional, acao: AcaoCicloVidaTenant) {
    setConfirmacao({ tenant, acao });
    setMotivo('');
    setExportacaoConfirmada(false);
    setProtocoloExportacao('');
  }

  function fecharConfirmacao() {
    setConfirmacao(null);
    setMotivo('');
    setExportacaoConfirmada(false);
    setProtocoloExportacao('');
  }

  return (
    <section id="operacoes-onboarding-painel" role="tabpanel" aria-labelledby="operacoes-onboarding-aba" hidden={!ativa} className="grid gap-4">
      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {sucesso ? <AlertaSucesso mensagem={sucesso} /> : null}
      <BarraCarregamento visivel={carregando} rotulo="Atualizando ciclo de vida das clinicas" />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { rotulo: 'Em ativacao', valor: totais.ativacao, icone: Clock3 },
          { rotulo: 'Ativos', valor: totais.ativos, icone: CheckCircle2 },
          { rotulo: 'Suspensos', valor: totais.suspensos, icone: PauseCircle }
        ].map((item) => (
          <Cartao key={item.rotulo}>
            <CartaoConteudo className="flex items-center justify-between gap-3">
              <div><p className="text-sm text-texto-suave">{item.rotulo}</p><p className="mt-1 text-2xl font-bold">{item.valor}</p></div>
              <item.icone size={22} className="text-primaria" aria-hidden="true" />
            </CartaoConteudo>
          </Cartao>
        ))}
      </div>

      <Cartao>
        <CartaoCabecalho>
          <div>
            <CartaoTitulo icone={<Building2 size={18} />}>Nova clinica</CartaoTitulo>
            <p className="mt-1 text-xs text-texto-suave">O proprietario define a propria senha pelo convite. Repetir a mesma referencia nao duplica dados.</p>
          </div>
        </CartaoCabecalho>
        <CartaoConteudo>
          <form onSubmit={provisionar} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div><Rotulo htmlFor="onboarding-nome">Nome da clinica</Rotulo><Campo id="onboarding-nome" required maxLength={160} value={formulario.nome} onChange={(e) => setFormulario((a) => ({ ...a, nome: e.target.value }))} /></div>
            <div><Rotulo htmlFor="onboarding-slug">Identificador de acesso</Rotulo><Campo id="onboarding-slug" required pattern="[a-z0-9][a-z0-9-]*[a-z0-9]" placeholder="clinica-exemplo" value={formulario.slug} onChange={(e) => setFormulario((a) => ({ ...a, slug: e.target.value.toLowerCase() }))} /></div>
            <div><Rotulo htmlFor="onboarding-referencia">Referencia comercial</Rotulo><Campo id="onboarding-referencia" required pattern="[a-z0-9][a-z0-9._-]*" placeholder="contrato-2026-001" value={formulario.referencia} onChange={(e) => setFormulario((a) => ({ ...a, referencia: e.target.value.toLowerCase() }))} /></div>
            <div><Rotulo htmlFor="onboarding-email">E-mail do proprietario</Rotulo><Campo id="onboarding-email" type="email" required value={formulario.emailProprietario} onChange={(e) => setFormulario((a) => ({ ...a, emailProprietario: e.target.value }))} /></div>
            <div><Rotulo htmlFor="onboarding-plano">Plano inicial</Rotulo><Selecao id="onboarding-plano" value={formulario.planoId} onChange={(e) => setFormulario((a) => ({ ...a, planoId: e.target.value as DadosProvisionamentoTenant['planoId'] }))}><option value="gratuito">Gratuito</option><option value="profissional">Profissional</option><option value="clinica">Clinica</option><option value="enterprise">Enterprise</option></Selecao></div>
            <div><Rotulo htmlFor="onboarding-timezone">Fuso horario</Rotulo><Selecao id="onboarding-timezone" value={formulario.timezone} onChange={(e) => setFormulario((a) => ({ ...a, timezone: e.target.value }))}><option value="America/Sao_Paulo">America/Sao_Paulo</option><option value="America/Manaus">America/Manaus</option><option value="America/Recife">America/Recife</option><option value="America/Rio_Branco">America/Rio_Branco</option></Selecao></div>
            <div className="md:col-span-2 xl:col-span-3"><Botao type="submit" variante="primario" carregando={salvando}><Plus size={16} />Provisionar e convidar</Botao></div>
          </form>
        </CartaoConteudo>
      </Cartao>

      <Cartao>
        <CartaoCabecalho>
          <div><CartaoTitulo>Clinicas e ativacoes</CartaoTitulo><p className="mt-1 text-xs text-texto-suave">Acoes irreversiveis exigem confirmacao explicita.</p></div>
          <Botao type="button" onClick={() => void carregar()} disabled={carregando}><RefreshCcw size={16} />Atualizar</Botao>
        </CartaoCabecalho>
        <div className="divide-y divide-linha">
          {tenants.length ? tenants.map((tenant) => (
            <article key={tenant.id} className="grid gap-3 px-4 py-4 xl:grid-cols-[1.25fr_0.8fr_1fr] xl:items-center">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm">{tenant.nome}</strong><EtiquetaStatus status={tenant.cicloVidaStatus} mapa={estados} /></div><p className="mt-1 text-xs text-texto-suave">{tenant.slug} | {tenant.planoId} | {tenant.assinaturaStatus}</p><p className="mt-1 text-xs text-texto-suave">Proprietario: {tenant.proprietarioEmailMascarado ?? 'nao localizado'} | convite {tenant.conviteStatus ?? 'sem registro'}</p></div>
              <div className="text-xs text-texto-suave"><p>Referencia: {tenant.provisionamentoReferencia ?? 'legado'}</p><p className="mt-1">Atualizado: {formatarData(tenant.atualizadoEm)}</p></div>
              <div className="flex flex-wrap gap-2 xl:justify-end">{acoesDisponiveis(tenant.cicloVidaStatus).map((acao) => <Botao key={acao} type="button" tamanho="sm" variante={acao === 'encerrar' || acao === 'iniciar_encerramento' ? 'perigo' : acao === 'suspender' ? 'secundario' : 'primario'} onClick={() => abrirConfirmacao(tenant, acao)}>{acao === 'suspender' ? <PauseCircle size={15} /> : acao === 'reativar' ? <PlayCircle size={15} /> : acao.includes('encerr') ? <Archive size={15} /> : <CheckCircle2 size={15} />}{rotulosAcao[acao]}</Botao>)}</div>
            </article>
          )) : <EstadoVazio titulo="Nenhuma clinica encontrada." descricao="Provisione a primeira clinica pelo formulario acima." />}
        </div>
      </Cartao>

      <Modal aberto={Boolean(confirmacao)} aoFechar={fecharConfirmacao} titulo={confirmacao ? rotulosAcao[confirmacao.acao] : 'Confirmar acao'} descricao={confirmacao ? `Clinica: ${confirmacao.tenant.nome}` : undefined}>
        <div className="grid gap-4">
          <div><Rotulo htmlFor="onboarding-motivo">Motivo operacional</Rotulo><Campo id="onboarding-motivo" maxLength={500} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Registre o contexto desta decisao" /></div>
          {confirmacao?.acao === 'encerrar' ? <><div><Rotulo htmlFor="onboarding-protocolo-exportacao">Protocolo da exportacao entregue</Rotulo><Campo id="onboarding-protocolo-exportacao" required pattern="[a-zA-Z0-9][a-zA-Z0-9._/-]*" maxLength={120} value={protocoloExportacao} onChange={(e) => setProtocoloExportacao(e.target.value)} placeholder="EXP-2026-001" /></div><label className="flex min-h-11 items-start gap-3 rounded-md border border-perigo-borda bg-perigo-suave p-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={exportacaoConfirmada} onChange={(e) => setExportacaoConfirmada(e.target.checked)} /><span>Confirmo que a exportacao foi entregue e que o encerramento revogara todos os acessos deste tenant.</span></label></> : null}
          <div className="flex justify-end gap-2"><Botao type="button" onClick={fecharConfirmacao} disabled={salvando}>Voltar</Botao><Botao type="button" variante={confirmacao?.acao === 'encerrar' || confirmacao?.acao === 'iniciar_encerramento' ? 'perigo' : 'primario'} carregando={salvando} disabled={confirmacao?.acao === 'encerrar' && (!exportacaoConfirmada || !protocoloExportacao.trim())} onClick={() => void confirmarAcao()}>Confirmar</Botao></div>
        </div>
      </Modal>
    </section>
  );
}
