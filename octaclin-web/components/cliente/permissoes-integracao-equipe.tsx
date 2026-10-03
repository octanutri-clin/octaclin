'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Save } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo } from '@/components/ui/cartao';
import type { UsuarioClienteApi } from '@/lib/cliente-api';
import {
  atualizarPermissoesIntegracaoProfissionalApi,
  EscopoApi,
  EventoWebhook,
  listarPermissoesIntegracaoProfissionaisApi
} from '@/lib/integracoes-api';

const escopos: Array<{ id: EscopoApi; rotulo: string }> = [
  { id: 'pacientes:ler', rotulo: 'Consultar pacientes' },
  { id: 'pacientes:escrever', rotulo: 'Cadastrar pacientes' },
  { id: 'agenda:ler', rotulo: 'Consultar agenda' },
  { id: 'agenda:escrever', rotulo: 'Criar e cancelar consultas' }
];

const eventos: Array<{ id: EventoWebhook; rotulo: string }> = [
  { id: 'paciente.criado', rotulo: 'Paciente criado' },
  { id: 'consulta.criada', rotulo: 'Consulta criada' },
  { id: 'consulta.cancelada', rotulo: 'Consulta cancelada' },
  { id: 'formulario.respondido', rotulo: 'Formulário respondido' }
];

type Estado = {
  escoposApi: EscopoApi[];
  eventosWebhook: EventoWebhook[];
  concedidaApiEm?: string;
  concedidaWebhookEm?: string;
  concedidaApiPorUsuarioId?: string;
  concedidaWebhookPorUsuarioId?: string;
};

export function PermissoesIntegracaoEquipe({ usuarios }: { usuarios: UsuarioClienteApi[] }) {
  const profissionais = usuarios.filter((usuario) => usuario.role === 'Professional' && usuario.ativo);
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const permissoes = await listarPermissoesIntegracaoProfissionaisApi();
      setEstados(Object.fromEntries(permissoes.map((item) => [item.usuarioId, item])));
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao carregar acessos de integração.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { void carregar(); }, [carregar]);

  function alternar(usuarioId: string, chave: keyof Estado, valor: EscopoApi | EventoWebhook, marcado: boolean) {
    setEstados((anteriores) => {
      const atual = anteriores[usuarioId] ?? { escoposApi: [], eventosWebhook: [] };
      const lista = atual[chave] as Array<EscopoApi | EventoWebhook>;
      const atualizada = marcado ? [...lista, valor] : lista.filter((item) => item !== valor);
      return { ...anteriores, [usuarioId]: { ...atual, [chave]: atualizada } };
    });
  }

  async function salvar(usuarioId: string) {
    const estado = estados[usuarioId] ?? { escoposApi: [], eventosWebhook: [] };
    setSalvando(usuarioId);
    setErro(null);
    setSucesso(null);
    try {
      await atualizarPermissoesIntegracaoProfissionalApi(usuarioId, {
        escoposApi: estado.escoposApi,
        eventosWebhook: estado.eventosWebhook
      });
      setSucesso('Permissões de integração atualizadas.');
      await carregar();
    } catch (erroAtual) {
      setErro(erroAtual instanceof Error ? erroAtual.message : 'Falha ao salvar permissões de integração.');
    } finally {
      setSalvando(null);
    }
  }

  return (
    <Cartao id="permissoes-integracoes" className="scroll-mt-4" aria-busy={carregando}>
      <CartaoCabecalho>
        <div>
          <h2 className="text-sm font-semibold">Acesso profissional às integrações</h2>
          <p className="mt-1 text-sm text-texto-suave">Defina separadamente os escopos de API e os eventos de webhook para cada profissional.</p>
        </div>
      </CartaoCabecalho>
      <CartaoConteudo className="grid gap-4">
        <p className="flex gap-2 rounded-md border border-aviso-borda bg-aviso-suave p-3 text-sm text-texto-forte">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Reduzir ou remover permissões interrompe o uso das credenciais profissionais afetadas. Elas continuam cadastradas; revogue as chaves ou desative os webhooks em Integrações para encerrá-los definitivamente.
        </p>
        {erro ? <p className="text-sm text-perigo" role="alert">{erro}</p> : null}
        {sucesso ? <p className="flex items-center gap-2 text-sm text-sucesso-forte" role="status"><CheckCircle2 size={16} />{sucesso}</p> : null}
        {profissionais.length ? profissionais.map((usuario) => {
          const estado = estados[usuario.id] ?? { escoposApi: [], eventosWebhook: [] };
          return (
            <section key={usuario.id} className="grid gap-3 rounded-md border border-linha p-4">
              <h3 className="break-all text-sm font-semibold">{usuario.email}</h3>
              <p className="text-xs text-texto-suave">
                API: {estado.escoposApi.length
                  ? `concedida${estado.concedidaApiEm ? ` em ${new Date(estado.concedidaApiEm).toLocaleString('pt-BR')}` : ''}${estado.concedidaApiPorUsuarioId ? ` por ${usuarios.find((item) => item.id === estado.concedidaApiPorUsuarioId)?.email ?? 'gestor da clínica'}` : ''}`
                  : 'sem acesso'}
                {' · '}
                Webhook: {estado.eventosWebhook.length
                  ? `concedido${estado.concedidaWebhookEm ? ` em ${new Date(estado.concedidaWebhookEm).toLocaleString('pt-BR')}` : ''}${estado.concedidaWebhookPorUsuarioId ? ` por ${usuarios.find((item) => item.id === estado.concedidaWebhookPorUsuarioId)?.email ?? 'gestor da clínica'}` : ''}`
                  : 'sem acesso'}
              </p>
              <fieldset><legend className="text-xs font-semibold text-texto-suave">Escopos de API</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{escopos.map((item) => <label key={item.id} className="flex min-h-11 items-center gap-2 rounded-md border border-linha px-3 text-sm"><input type="checkbox" checked={estado.escoposApi.includes(item.id)} onChange={(evento) => alternar(usuario.id, 'escoposApi', item.id, evento.target.checked)} />{item.rotulo}</label>)}</div></fieldset>
              <fieldset><legend className="text-xs font-semibold text-texto-suave">Eventos de webhook</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{eventos.map((item) => <label key={item.id} className="flex min-h-11 items-center gap-2 rounded-md border border-linha px-3 text-sm"><input type="checkbox" checked={estado.eventosWebhook.includes(item.id)} onChange={(evento) => alternar(usuario.id, 'eventosWebhook', item.id, evento.target.checked)} />{item.rotulo}</label>)}</div></fieldset>
              <div className="flex justify-end"><Botao type="button" variante="primario" onClick={() => void salvar(usuario.id)} disabled={carregando || salvando === usuario.id}><Save size={16} />{salvando === usuario.id ? 'Salvando' : 'Salvar permissões'}</Botao></div>
            </section>
          );
        }) : <p className="text-sm text-texto-suave">Nenhum profissional ativo disponível para configurar integrações.</p>}
      </CartaoConteudo>
    </Cartao>
  );
}
