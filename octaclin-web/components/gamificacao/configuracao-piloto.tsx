'use client';

import { useEffect, useState } from 'react';
import { obterConfiguracaoPiloto, atualizarConfiguracaoPiloto, listarRetencoesPiloto, registrarExcecaoRetencaoPiloto, chavePiloto, type ConfiguracaoPilotoApi, type ItemRetencaoPilotoApi } from '@/lib/gamificacao-piloto-api';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { Aviso } from '@/components/ui/feedback';
import { obterSessao } from '@/lib/auth-api';
import { listarTenantsOnboarding, type TenantOnboardingOperacional } from '@/lib/onboarding-operacoes-api';

export function ConfiguracaoPiloto() {
  const [configState, setConfigState] = useState<{ destino: string; config: ConfiguracaoPilotoApi } | null>(null);
  const [tenants, setTenants] = useState<TenantOnboardingOperacional[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [papel, setPapel] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [retencoes, setRetencoes] = useState<ItemRetencaoPilotoApi[]>([]);
  const [cursorRetencao, setCursorRetencao] = useState<string | undefined>();
  const [temMaisRetencao, setTemMaisRetencao] = useState(false);
  const [denunciaSelecionada, setDenunciaSelecionada] = useState('');
  const [holdAte, setHoldAte] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [confirmacaoLegal, setConfirmacaoLegal] = useState(false);
  const [salvandoRetencao, setSalvandoRetencao] = useState(false);
  const [chaveRetencao, setChaveRetencao] = useState<string | null>(null);
  const destinoAtual = papel === 'SuperAdmin' ? tenantId : 'client';
  const config = configState?.destino === destinoAtual ? configState.config : null;

  useEffect(() => {
    void obterSessao().then(async (session) => {
      setPapel(session?.papel ?? null);
      if (session?.papel === 'Client' && session.permissoes.includes('cliente.configuracoes.gerenciar')) {
        setConfigState({ destino: 'client', config: await obterConfiguracaoPiloto() });
        const page = await listarRetencoesPiloto();
        setRetencoes(page.itens); setCursorRetencao(page.proximoCursor); setTemMaisRetencao(page.temMais);
      } else if (session?.papel === 'SuperAdmin' && session.permissoes.includes('operacoes.tenants.gerenciar')) {
        const result = await listarTenantsOnboarding();
        setTenants(result.itens.filter((tenant) => tenant.cicloVidaStatus !== 'encerrado'));
      } else setErro('Esta área é exclusiva do gestor da clínica ou do SuperAdmin.');
    }).catch((e: unknown) => setErro(e instanceof Error ? e.message : 'Configuração indisponível.'));
  }, []);

  useEffect(() => {
    if (papel !== 'SuperAdmin' || !tenantId) return;
    let ativo = true;
    void obterConfiguracaoPiloto(tenantId).then((value) => { if (ativo) setConfigState({ destino: tenantId, config: value }); }).catch((e: unknown) => { if (ativo) setErro(e instanceof Error ? e.message : 'Configuração indisponível.'); });
    return () => { ativo = false; };
  }, [papel, tenantId]);

  async function salvar(chave: 'conquistas' | 'comunidade') {
    if (!config) return;
    const value = !config[chave];
    if (value && !config.operacaoAprovada) return;
    if (!window.confirm(value ? 'Habilitar esta função para a clínica? Os pacientes ainda precisarão aceitar cada compartilhamento ou convite.' : 'Desabilitar esta função? Os dados e opções de privacidade existentes serão preservados.')) return;
    setSalvando(true); setErro(null);
    try { const updated = await atualizarConfiguracaoPiloto({ ...config, [chave]: value }, papel === 'SuperAdmin' ? tenantId : undefined); setConfigState({ destino: destinoAtual, config: updated }); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível salvar. Recarregue e confira o estado.'); }
    finally { setSalvando(false); }
  }

  async function carregarMaisRetencoes() {
    if (!cursorRetencao) return;
    setErro(null);
    try {
      const page = await listarRetencoesPiloto(cursorRetencao);
      setRetencoes((current) => [...current, ...page.itens]); setCursorRetencao(page.proximoCursor); setTemMaisRetencao(page.temMais);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível carregar os prazos de retenção.'); }
  }

  async function registrarRetencao() {
    const selected = retencoes.find((item) => item.id === denunciaSelecionada);
    if (!selected || !holdAte || !justificativa.trim() || !confirmacaoLegal) return;
    setSalvandoRetencao(true); setErro(null);
    try {
      const chave = chaveRetencao ?? chavePiloto(); setChaveRetencao(chave);
      await registrarExcecaoRetencaoPiloto({ denunciaId: selected.id, chave, versaoEsperada: selected.versao, holdAte: new Date(holdAte).toISOString(), justificativa: justificativa.trim(), confirmacaoLegal: true });
      const page = await listarRetencoesPiloto();
      setRetencoes(page.itens); setCursorRetencao(page.proximoCursor); setTemMaisRetencao(page.temMais);
      setDenunciaSelecionada(''); setHoldAte(''); setJustificativa(''); setConfirmacaoLegal(false); setChaveRetencao(null);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível registrar a exceção. Atualize e confira os dados.'); }
    finally { setSalvandoRetencao(false); }
  }

  if (papel === 'Professional') return null;

  return (
    <Cartao>
      <CartaoCabecalho><CartaoTitulo>Disponibilidade na clínica</CartaoTitulo></CartaoCabecalho>
      <CartaoConteudo className="grid gap-4">
        {erro ? <Aviso variante="alerta" mensagem={erro} /> : null}
        {!config && !erro ? <p role="status">{papel === 'SuperAdmin' && !tenantId ? 'Selecione uma clínica para conferir a configuração.' : 'Carregando as opções da clínica…'}</p> : null}
        {papel === 'SuperAdmin' ? <div><label htmlFor="tenant-piloto" className="text-sm font-medium">Clínica</label><select id="tenant-piloto" className="mt-1 min-h-11 w-full rounded-md border border-linha bg-white px-3 text-sm" value={tenantId} onChange={(e) => setTenantId(e.target.value)}><option value="">Selecione uma clínica</option>{tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.nome}</option>)}</select></div> : null}
        {config ? <>
          <p className="text-sm text-texto-suave">
            {config.operacaoAprovada ? 'A operação foi autorizada para este ambiente.' : 'O piloto permanece bloqueado até a revisão operacional e a aprovação formal. As opções abaixo não podem habilitar o serviço enquanto esse gate estiver fechado.'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['conquistas', 'comunidade'] as const).map((item) => (
              <section key={item} className="rounded-md border border-linha p-4">
                <h3 className="font-semibold">{item === 'conquistas' ? 'Conquistas privadas' : 'Círculos da comunidade'}</h3>
                <p className="mt-1 text-sm text-texto-suave">Estado: {config[item] ? 'disponível' : 'desligado'}</p>
                <Botao className="mt-3" type="button" disabled={salvando || (!config.operacaoAprovada && !config[item])} onClick={() => void salvar(item)}>
                  {salvando ? 'Salvando…' : config[item] ? 'Desligar' : 'Habilitar'}
                </Botao>
              </section>
            ))}
          </div>
        </> : null}
        {papel === 'Client' ? <section aria-labelledby="retencao-title" className="grid gap-3 border-t border-linha pt-4">
          <div><h3 id="retencao-title" className="font-semibold">Exceções de retenção documentadas</h3><p className="mt-1 text-sm text-texto-suave">Esta área mostra somente identificador e prazos, sem conteúdo das denúncias. Use-a apenas quando a clínica tiver uma necessidade legal documentada. O prazo adicional é limitado a 90 dias e exige revisão.</p></div>
          {retencoes.length ? <ul className="grid gap-2">{retencoes.map((item) => <li key={item.id} className="rounded-md border border-linha p-3 text-sm"><p>Registro {item.id} · versão {item.versao}</p><p>Retenção ordinária até {new Date(item.eliminarEm).toLocaleString()}</p>{item.holdAte ? <p>Hold registrado até {new Date(item.holdAte).toLocaleString()}</p> : <p>Nenhum hold registrado</p>}</li>)}</ul> : <p className="text-sm text-texto-suave">Nenhum registro elegível para exceção de retenção.</p>}
          {temMaisRetencao ? <Botao type="button" variante="secundario" onClick={() => void carregarMaisRetencoes()}>Carregar mais registros</Botao> : null}
          {retencoes.length ? <div className="grid gap-3 rounded-md border border-linha p-4">
            <h4 className="font-medium">Registrar exceção legal temporária</h4>
            <div><label htmlFor="retencao-denuncia" className="text-sm font-medium">Registro</label><select id="retencao-denuncia" className="mt-1 min-h-11 w-full rounded-md border border-linha bg-white px-3 text-sm" value={denunciaSelecionada} onChange={(e) => { setDenunciaSelecionada(e.target.value); setChaveRetencao(null); }}><option value="">Selecione um registro</option>{retencoes.map((item) => <option key={item.id} value={item.id}>{item.id} · versão {item.versao}</option>)}</select></div>
            <div><label htmlFor="retencao-ate" className="text-sm font-medium">Manter até</label><input id="retencao-ate" type="datetime-local" className="mt-1 min-h-11 w-full rounded-md border border-linha px-3 text-sm" value={holdAte} onChange={(e) => { setHoldAte(e.target.value); setChaveRetencao(null); }} /></div>
            <div><label htmlFor="retencao-justificativa" className="text-sm font-medium">Justificativa legal documentada</label><textarea id="retencao-justificativa" className="mt-1 min-h-24 w-full rounded-md border border-linha p-3 text-sm" maxLength={1000} value={justificativa} onChange={(e) => { setJustificativa(e.target.value); setChaveRetencao(null); }} /></div>
            <label className="flex items-start gap-3 text-sm"><input className="mt-1 size-4" type="checkbox" checked={confirmacaoLegal} onChange={(e) => { setConfirmacaoLegal(e.target.checked); setChaveRetencao(null); }} /><span>Confirmo que a clínica documentou uma necessidade legal para essa retenção e que a exceção foi revisada por pessoa autorizada.</span></label>
            <Botao type="button" disabled={salvandoRetencao || !denunciaSelecionada || !holdAte || !justificativa.trim() || !confirmacaoLegal} onClick={() => void registrarRetencao()}>{salvandoRetencao ? 'Registrando…' : 'Registrar exceção'}</Botao>
          </div> : null}
        </section> : null}
      </CartaoConteudo>
    </Cartao>
  );
}
