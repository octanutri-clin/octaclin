'use client';

import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, Gauge, GitCommitHorizontal, RotateCcw, Save } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Rotulo, Selecao } from '@/components/ui/campo';
import { Cartao, CartaoCabecalho, CartaoConteudo } from '@/components/ui/cartao';
import { AlertaOperacional, AlertaSucesso, EstadoVazio } from '@/components/ui/feedback';
import { atualizarFeatureFlagsOperacionais, carregarFeatureFlagsOperacionais } from '@/lib/operacoes-api';
import { listarTenantsOnboarding, TenantOnboardingOperacional } from '@/lib/onboarding-operacoes-api';
import { PainelOperacoesControlador } from './use-painel-operacoes';

function statusClasse(status: string) {
  if (status === 'critico' || status === 'falha' || status === 'indisponivel') return 'text-perigo';
  if (status === 'atencao' || status === 'degradado') return 'text-alerta';
  return 'text-sucesso';
}

export function AreaRollout({ controlador }: { controlador: PainelOperacoesControlador }) {
  const { areaAtiva, dados, carregar } = controlador;
  const rollout = dados?.rollout;
  const [tenants, setTenants] = useState<TenantOnboardingOperacional[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [iaClinica, setIaClinica] = useState(false);
  const [mobileSync, setMobileSync] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  useEffect(() => {
    if (areaAtiva !== 'rollout') return;
    void listarTenantsOnboarding()
      .then((resultado) => setTenants(resultado.itens.filter((tenant) => tenant.cicloVidaStatus !== 'encerrado')))
      .catch((erroAtual) => setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar clínicas.'));
  }, [areaAtiva]);

  useEffect(() => {
    if (!tenantId) {
      setIaClinica(false);
      setMobileSync(false);
      return;
    }
    setErro(null);
    void carregarFeatureFlagsOperacionais(tenantId)
      .then((resultado) => {
        setIaClinica(resultado.flags.find((flag) => flag.chave === 'ia.clinica')?.habilitada ?? false);
        setMobileSync(resultado.flags.find((flag) => flag.chave === 'mobile.sync')?.habilitada ?? false);
      })
      .catch((erroAtual) => setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar funcionalidades.'));
  }, [tenantId]);

  async function salvar() {
    if (!tenantId) {
      setErro('Selecione a clínica que recebera o rollout.');
      return;
    }
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      await atualizarFeatureFlagsOperacionais({ tenantId, iaClinica, mobileSync });
      setSucesso('Funcionalidades atualizadas para a clínica selecionada e registradas na auditoria.');
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao atualizar rollout.');
    } finally {
      setSalvando(false);
    }
  }

  if (areaAtiva !== 'rollout') return null;

  const metricas = rollout
    ? [
        { rotulo: 'Decisao', valor: rollout.decisaoSugerida, icone: rollout.decisaoSugerida === 'rollback' ? RotateCcw : CheckCircle2 },
        { rotulo: 'Requisicoes', valor: rollout.telemetria.http.total, icone: Activity },
        { rotulo: 'Erros 5xx', valor: `${(rollout.telemetria.http.taxaErro5xx * 100).toFixed(1)}%`, icone: Gauge },
        { rotulo: 'P95', valor: `${rollout.telemetria.http.duracaoP95Ms} ms`, icone: Gauge }
      ]
    : [];

  return (
    <section id="operacoes-rollout-painel" role="tabpanel" aria-labelledby="operacoes-rollout-aba" className="grid gap-4">
      {erro ? <AlertaOperacional mensagem={erro} /> : null}
      {sucesso ? <AlertaSucesso mensagem={sucesso} /> : null}
      {rollout ? (
        <>
          <div className="flex flex-col gap-3 border-b border-linha pb-4 md:flex-row md:items-center md:justify-between">
            <div><div className="flex items-center gap-2"><GitCommitHorizontal size={18} className="text-primaria" /><h2 className="text-base font-semibold">Release {rollout.release.commit}</h2></div><p className="mt-1 text-xs text-texto-suave">{rollout.release.ambiente} | {rollout.release.papelProcesso} | atualizado {new Date(rollout.geradoEm).toLocaleString('pt-BR')}</p></div>
            <strong className={statusClasse(rollout.status)}>{rollout.status.toUpperCase()}</strong>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metricas.map((item) => <Cartao key={item.rotulo}><CartaoConteudo className="flex items-center justify-between gap-3"><div><p className="text-sm text-texto-suave">{item.rotulo}</p><p className="mt-1 text-xl font-bold capitalize">{item.valor}</p></div><item.icone size={20} className="text-primaria" /></CartaoConteudo></Cartao>)}</div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Cartao><CartaoCabecalho><h3 className="text-base font-semibold">Filas e integrações</h3></CartaoCabecalho><div className="divide-y divide-linha">{rollout.filas.map((fila) => <div key={fila.nome} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><div><strong>{fila.nome.replace('_', ' ')}</strong><p className="mt-1 text-xs text-texto-suave">Aguardando {fila.esperando} | Ativas {fila.ativas} | Atrasadas {fila.atrasadas}</p></div><span className={statusClasse(fila.status)}>{fila.falharam ? `${fila.falharam} falhas` : fila.status}</span></div>)}</div></Cartao>
            <Cartao><CartaoCabecalho><h3 className="text-base font-semibold">Rastreamentos sanitizados</h3></CartaoCabecalho><div className="divide-y divide-linha">{rollout.telemetria.tracesRecentes.length ? rollout.telemetria.tracesRecentes.slice(0, 8).map((trace) => <div key={`${trace.requestId}-${trace.horario}`} className="px-4 py-3"><div className="flex items-center justify-between gap-3 text-sm"><strong>{trace.metodo} {trace.rota}</strong><span className={statusClasse(trace.resultado === 'erro_servidor' ? 'critico' : 'ok')}>{trace.statusCode}</span></div><p className="mt-1 text-xs text-texto-suave">{trace.duracaoMs} ms | {trace.requestId}</p></div>) : <EstadoVazio titulo="Sem traces nesta instancia" descricao="As amostras aparecem após o backend receber requisicoes." />}</div></Cartao>
          </div>

          <Cartao><CartaoCabecalho><div><h3 className="text-base font-semibold">Liberacao controlada</h3><p className="mt-1 text-xs text-texto-suave">IA e Mobile permanecem bloqueados por padrao. Selecione uma clínica para alterar o acesso.</p></div></CartaoCabecalho><CartaoConteudo className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto_auto_auto] md:items-end"><div><Rotulo htmlFor="rollout-tenant">Clínica</Rotulo><Selecao id="rollout-tenant" value={tenantId} onChange={(evento) => setTenantId(evento.target.value)}><option value="">Selecione</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.nome} ({tenant.slug})</option>)}</Selecao></div><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={iaClinica} onChange={(evento) => setIaClinica(evento.target.checked)} />IA clínica</label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4" checked={mobileSync} onChange={(evento) => setMobileSync(evento.target.checked)} />Mobile</label><Botao type="button" variante="primario" carregando={salvando} onClick={() => void salvar()}><Save size={16} />Aplicar</Botao></CartaoConteudo></Cartao>
        </>
      ) : <EstadoVazio titulo="Carregando rollout" />}
    </section>
  );
}
