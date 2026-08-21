'use client';

import { AlertTriangle, CheckCircle2, Save, ShieldCheck } from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho } from '@/components/ui/cartao';
import { AtualizarConfiguracoesClienteEntrada } from '@/lib/cliente-api';
import { ModelosDocumentoCliente } from './modelos-documento';
import { formatarData } from './portal-cliente-dominio';
import { RecebimentosCliente } from './recebimentos-cliente';
import { PortalClienteController } from './use-portal-cliente';
import { IntegracoesApiCliente } from './integracoes-api-cliente';

type Props = { portal: PortalClienteController };

export function AreasConfiguracaoCliente({ portal }: Props) {
  const {
    areaAtiva,
    podeGerenciarConfiguracoes,
    podeLerFinanceiro,
    carregandoConfiguracoes,
    configuracoes,
    erroConfiguracoes,
    sucessoConfiguracoes,
    formularioConfiguracoes,
    setFormularioConfiguracoes,
    salvandoConfiguracoes,
    salvarConfiguracoes
  } = portal;

  return (
    <>
      {podeGerenciarConfiguracoes && ['preferencias', 'marca', 'integracoes'].includes(areaAtiva) ? (
        <Cartao id="configuracoes" className="scroll-mt-4" aria-busy={carregandoConfiguracoes}>
          <CartaoCabecalho>
            <ShieldCheck className="h-4 w-4 text-texto-suave" />
            <div>
              <h2 className="text-sm font-semibold">
                {areaAtiva === 'marca'
                  ? 'Identidade da clinica'
                  : areaAtiva === 'integracoes'
                    ? 'Integracoes da conta'
                    : 'Preferencias da conta'}
              </h2>
              <p className="mt-1 text-sm text-texto-suave">
                {configuracoes
                  ? `Atualizado em ${formatarData(configuracoes.atualizadoEm)}`
                  : 'Carregando preferencias da conta'}
              </p>
            </div>
          </CartaoCabecalho>
          <form onSubmit={salvarConfiguracoes} className="grid gap-4 p-4">
            {erroConfiguracoes ? (
              <div className="flex items-center gap-2 rounded-lg border border-perigo-borda bg-perigo-suave px-4 py-3 text-sm text-perigo">
                <AlertTriangle size={16} />
                {erroConfiguracoes}
              </div>
            ) : null}
            {sucessoConfiguracoes ? (
              <div className="flex items-center gap-2 rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte">
                <CheckCircle2 size={16} />
                {sucessoConfiguracoes}
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              {areaAtiva === 'preferencias' ? (
                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                  Nome da clínica
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioConfiguracoes.nome}
                    onChange={(evento) =>
                      setFormularioConfiguracoes((atual) => ({ ...atual, nome: evento.target.value }))
                    }
                    required
                    maxLength={160}
                  />
                </label>
              ) : null}
              {areaAtiva === 'marca' ? (
                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                  Nome exibido
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioConfiguracoes.marca.nomeExibido}
                    onChange={(evento) =>
                      setFormularioConfiguracoes((atual) => ({
                        ...atual,
                        marca: { ...atual.marca, nomeExibido: evento.target.value }
                      }))
                    }
                    required
                    maxLength={120}
                  />
                </label>
              ) : null}
              {areaAtiva === 'preferencias' ? (
                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                  Timezone
                  <select
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioConfiguracoes.timezone}
                    onChange={(evento) =>
                      setFormularioConfiguracoes((atual) => ({ ...atual, timezone: evento.target.value }))
                    }
                  >
                    <option value="America/Sao_Paulo">America/Sao_Paulo</option>
                    <option value="America/Fortaleza">America/Fortaleza</option>
                    <option value="America/Manaus">America/Manaus</option>
                    <option value="America/Recife">America/Recife</option>
                  </select>
                </label>
              ) : null}
              {areaAtiva === 'preferencias' ? (
                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                  Idioma
                  <select
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioConfiguracoes.idioma}
                    onChange={(evento) =>
                      setFormularioConfiguracoes((atual) => ({
                        ...atual,
                        idioma: evento.target.value as AtualizarConfiguracoesClienteEntrada['idioma']
                      }))
                    }
                  >
                    <option value="pt-BR">pt-BR</option>
                    <option value="en-US">en-US</option>
                    <option value="es">es</option>
                  </select>
                </label>
              ) : null}
              {areaAtiva === 'marca' ? (
                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                  Email remetente
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    type="email"
                    value={formularioConfiguracoes.marca.emailRemetente}
                    onChange={(evento) =>
                      setFormularioConfiguracoes((atual) => ({
                        ...atual,
                        marca: { ...atual.marca, emailRemetente: evento.target.value }
                      }))
                    }
                    maxLength={180}
                  />
                </label>
              ) : null}
              {areaAtiva === 'marca' ? (
                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                  Cor primaria
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    type="color"
                    value={formularioConfiguracoes.marca.corPrimaria}
                    onChange={(evento) =>
                      setFormularioConfiguracoes((atual) => ({
                        ...atual,
                        marca: { ...atual.marca, corPrimaria: evento.target.value }
                      }))
                    }
                  />
                </label>
              ) : null}
            </div>

            {areaAtiva === 'integracoes' ? (
              <fieldset className="rounded-md border border-linha bg-superficie p-3">
                <legend className="px-1 text-xs font-semibold text-texto-suave">Canais padrao</legend>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  {[
                    ['email', 'Email'],
                    ['whatsapp', 'WhatsApp'],
                    ['googleCalendar', 'Google Calendar']
                  ].map(([chave, rotulo]) => (
                    <label
                      key={chave}
                      className="inline-flex h-10 items-center gap-2 rounded-md border border-linha bg-white px-3 text-sm font-medium"
                    >
                      <input
                        type="checkbox"
                        checked={
                          formularioConfiguracoes.canaisPadrao[
                            chave as keyof AtualizarConfiguracoesClienteEntrada['canaisPadrao']
                          ]
                        }
                        onChange={(evento) =>
                          setFormularioConfiguracoes((atual) => ({
                            ...atual,
                            canaisPadrao: { ...atual.canaisPadrao, [chave]: evento.target.checked }
                          }))
                        }
                      />
                      {rotulo}
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <div className="flex justify-end">
              <Botao type="submit" variante="primario" disabled={salvandoConfiguracoes || carregandoConfiguracoes}>
                <Save size={16} />
                {salvandoConfiguracoes ? 'Salvando' : 'Salvar configuracoes'}
              </Botao>
            </div>
          </form>
        </Cartao>
      ) : null}

      {podeLerFinanceiro && areaAtiva === 'financeiro' ? (
        <div
          id="conta-cliente-financeiro-painel"
          role="tabpanel"
          aria-labelledby="conta-cliente-financeiro-aba"
          className="grid gap-4"
        >
          <RecebimentosCliente />
        </div>
      ) : null}

      {podeGerenciarConfiguracoes && areaAtiva === 'documentos' ? (
        <div
          id="conta-cliente-documentos-painel"
          role="tabpanel"
          aria-labelledby="conta-cliente-documentos-aba"
          className="grid gap-4"
        >
          <ModelosDocumentoCliente />
        </div>
      ) : null}

      {podeGerenciarConfiguracoes && areaAtiva === 'integracoes' ? <IntegracoesApiCliente /> : null}
    </>
  );
}
