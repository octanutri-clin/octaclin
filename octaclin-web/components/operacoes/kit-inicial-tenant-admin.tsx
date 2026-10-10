'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { Rotulo, Selecao } from '@/components/ui/campo';
import {
  ChaveKitInicialClinicaApi,
  EstadoKitInicialClinicaApi,
  TenantOnboardingOperacional,
  instalarKitInicialTenant,
  obterKitInicialTenant
} from '@/lib/onboarding-operacoes-api';
import { KitInicialSeletor } from '@/components/kit-inicial/kit-inicial-seletor';

export function KitInicialTenantAdmin({ ativa, tenants }: { ativa: boolean; tenants: TenantOnboardingOperacional[] }) {
  const [tenantId, setTenantId] = useState('');
  const [estado, setEstado] = useState<EstadoKitInicialClinicaApi | null>(null);
  const [selecionadas, setSelecionadas] = useState<ChaveKitInicialClinicaApi[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const carregar = useCallback(async (id: string, signal?: AbortSignal) => {
    if (!id) return;
    setCarregando(true);
    setErro(null);
    setSucesso(null);
    try {
      const resposta = await obterKitInicialTenant(id, signal);
      if (!signal?.aborted) setEstado(resposta);
    } catch (erroAtual) {
      if (!signal?.aborted) {
        setEstado(null);
        setErro(erroAtual instanceof Error ? erroAtual.message : 'Não foi possível consultar esta clínica.');
      }
    } finally {
      if (!signal?.aborted) setCarregando(false);
    }
  }, []);

  useEffect(() => {
    if (!ativa || !tenantId) return;
    const controlador = new AbortController();
    queueMicrotask(() => { if (!controlador.signal.aborted) void carregar(tenantId, controlador.signal); });
    return () => controlador.abort();
  }, [ativa, carregar, tenantId]);

  function trocarTenant(id: string) {
    setTenantId(id);
    setEstado(null);
    setSelecionadas([]);
    setErro(null);
    setSucesso(null);
  }

  function alternar(chave: ChaveKitInicialClinicaApi) {
    setSelecionadas((atuais) => atuais.includes(chave) ? atuais.filter((item) => item !== chave) : [...atuais, chave]);
  }

  async function confirmar(): Promise<boolean> {
    const alvo = tenantId;
    if (!alvo) return false;
    setSalvando(true);
    setErro(null);
    setSucesso(null);
    try {
      const resposta = await instalarKitInicialTenant(alvo, selecionadas);
      if (alvo !== tenantId) return false;
      setEstado(resposta);
      setSelecionadas([]);
      setSucesso(resposta.instalacao.reutilizado
        ? 'Os itens já estavam instalados nesta clínica.'
        : `Kit instalado para ${resposta.tenantNome}. A confirmação administrativa foi registrada na auditoria.`);
      return true;
    } catch (erroAtual) {
      if (alvo === tenantId) setErro(erroAtual instanceof Error ? erroAtual.message : 'Não foi possível instalar o kit.');
      return false;
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="grid gap-4">
      <Cartao>
        <CartaoCabecalho>
          <CartaoTitulo icone={<Building2 className="h-4 w-4" />}>Kit inicial para clínica existente</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo>
          <p className="mb-3 text-sm text-texto-suave">Escolha uma clínica. Sua confirmação autoriza esta instalação e fica registrada com seu usuário.</p>
          <Rotulo htmlFor="kit-inicial-tenant-alvo">Clínica de destino</Rotulo>
          <Selecao id="kit-inicial-tenant-alvo" value={tenantId} onChange={(evento) => trocarTenant(evento.target.value)}>
            <option value="">Selecione uma clínica</option>
            {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.nome} · {tenant.slug}</option>)}
          </Selecao>
        </CartaoConteudo>
      </Cartao>
      {tenantId ? <KitInicialSeletor
        estado={estado}
        carregando={carregando}
        salvando={salvando}
        erro={erro}
        sucesso={sucesso}
        selecionadas={selecionadas}
        aoAlternar={alternar}
        aoSelecionarPendentes={() => setSelecionadas(estado?.itens.filter((item) => !item.instalado).map((item) => item.chave) ?? [])}
        aoRecarregar={() => void carregar(tenantId)}
        aoConfirmar={confirmar}
      /> : null}
    </div>
  );
}
