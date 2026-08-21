'use client';

import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Download,
  History,
  MailCheck,
  RefreshCcw,
  Save,
  Send,
  Trash2,
  UserPlus,
  UsersRound
} from 'lucide-react';
import { Botao } from '@/components/ui/botao';
import { Cartao, CartaoCabecalho, CartaoConteudo, CartaoTitulo } from '@/components/ui/cartao';
import { PapelUsuarioClienteCriavelApi } from '@/lib/cliente-api';
import {
  descreverHistoricoConvite,
  formatarData,
  formatarQuantidade,
  rotuloPapel
} from './portal-cliente-dominio';
import { PortalClienteController } from './use-portal-cliente';

type Props = { portal: PortalClienteController };

export function AreaEquipeCliente({ portal }: Props) {
  const {
    areaAtiva,
    resumo,
    podeVerGestaoUsuarios,
    podeLerUsuarios,
    podeConvidarUsuarios,
    podeGerenciarConvites,
    podeAjustarUsuarios,
    podeDesativarUsuarios,
    carregandoUsuarios,
    carregandoConvites,
    carregandoHistoricoConvites,
    erroUsuarios,
    sucessoUsuarios,
    usuarios,
    convites,
    historicoConvites,
    formularioUsuario,
    setFormularioUsuario,
    salvandoUsuario,
    bloqueioAssinatura,
    acaoConviteUsuarioId,
    papeisUsuarios,
    setPapeisUsuarios,
    nomesProfissionais,
    setNomesProfissionais,
    ajustandoUsuarioId,
    desativandoUsuarioId,
    setConfirmacaoUsuario,
    carregarUsuarios,
    convidarUsuario,
    reenviarConvite,
    ajustarPapelUsuario
  } = portal;
  if (areaAtiva !== 'equipe') return null;

  return (
    <>
      <Cartao id="usuarios" className="scroll-mt-4">
        <CartaoCabecalho>
          <CartaoTitulo icone={<UsersRound className="h-4 w-4" />}>Usuários</CartaoTitulo>
        </CartaoCabecalho>
        <CartaoConteudo className="grid gap-3">
          <article className="rounded-md border border-linha bg-superficie p-3">
            <p className="text-xs text-texto-suave">Gestor da conta</p>
            <p className="mt-1 break-words text-base font-semibold">Acesso de gestao ativo</p>
            <p className="mt-1 text-sm text-texto-suave">
              Assinatura, equipe e configurações respeitam as permissões concedidas.
            </p>
          </article>
          <article className="rounded-md border border-linha bg-superficie p-3">
            <p className="text-xs text-texto-suave">Separacao de acesso</p>
            <p className="mt-1 text-sm font-semibold">
              {resumo
                ? `${formatarQuantidade(resumo.usuarios.profissionais, 'profissional', 'profissionais')} e ${formatarQuantidade(
                    resumo.usuarios.pacientes,
                    'paciente',
                    'pacientes'
                  )}`
                : 'Profissionais e pacientes usam áreas isoladas.'}
            </p>
          </article>
        </CartaoConteudo>
      </Cartao>

      {podeVerGestaoUsuarios ? (
        <Cartao id="gestao-usuarios" className="scroll-mt-4" aria-busy={carregandoUsuarios}>
          <CartaoCabecalho className="flex-col items-start md:flex-row md:items-center">
            <div>
              <h2 className="text-sm font-semibold">Gerenciar usuários</h2>
              <p className="mt-1 text-sm text-texto-suave">
                {usuarios ? `${usuarios.total} acessos administrativos` : 'Carregando acessos administrativos'}
              </p>
            </div>
            {podeLerUsuarios ? (
              <Botao type="button" onClick={() => void carregarUsuarios()} disabled={carregandoUsuarios}>
                <RefreshCcw size={16} />
                {carregandoUsuarios ? 'Atualizando' : 'Atualizar'}
              </Botao>
            ) : null}
          </CartaoCabecalho>

          <div className="grid gap-4 p-4">
            {erroUsuarios ? (
              <div className="flex items-center gap-2 rounded-lg border border-perigo-borda bg-perigo-suave px-4 py-3 text-sm text-perigo">
                <AlertTriangle size={16} />
                {erroUsuarios}
              </div>
            ) : null}
            {sucessoUsuarios ? (
              <div className="flex items-center gap-2 rounded-lg border border-sucesso-borda bg-sucesso-suave px-4 py-3 text-sm text-sucesso-forte">
                <CheckCircle2 size={16} />
                {sucessoUsuarios}
              </div>
            ) : null}

            {podeConvidarUsuarios ? (
              <form
                onSubmit={convidarUsuario}
                className="grid gap-3 rounded-md border border-linha bg-superficie p-3 lg:grid-cols-[minmax(0,1fr)_180px_auto]"
              >
                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                  Email
                  <input
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    type="email"
                    value={formularioUsuario.email}
                    onChange={(evento) => setFormularioUsuario((atual) => ({ ...atual, email: evento.target.value }))}
                    required
                  />
                </label>
                <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                  Papel
                  <select
                    className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                    value={formularioUsuario.role}
                    onChange={(evento) =>
                      setFormularioUsuario((atual) => ({
                        ...atual,
                        role: evento.target.value as PapelUsuarioClienteCriavelApi
                      }))
                    }
                  >
                    <option value="Collaborator">Equipe administrativa</option>
                    <option value="Professional">Profissional</option>
                  </select>
                </label>
                {formularioUsuario.role === 'Professional' ? (
                  <>
                    <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                      Nome do profissional
                      <input
                        className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                        value={formularioUsuario.nomeProfissional}
                        onChange={(evento) =>
                          setFormularioUsuario((atual) => ({ ...atual, nomeProfissional: evento.target.value }))
                        }
                        required
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                      Registro profissional
                      <input
                        className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                        value={formularioUsuario.registroProfissional}
                        onChange={(evento) =>
                          setFormularioUsuario((atual) => ({ ...atual, registroProfissional: evento.target.value }))
                        }
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-semibold text-texto-suave">
                      Especialidade
                      <input
                        className="h-10 rounded-md border border-linha bg-white px-3 text-sm font-normal text-tinta"
                        value={formularioUsuario.especialidade}
                        onChange={(evento) =>
                          setFormularioUsuario((atual) => ({ ...atual, especialidade: evento.target.value }))
                        }
                      />
                    </label>
                  </>
                ) : null}
                <div className="flex items-end">
                  <Botao
                    type="submit"
                    variante="primario"
                    disabled={salvandoUsuario || bloqueioAssinatura}
                    className="w-full"
                  >
                    <UserPlus size={16} />
                    {salvandoUsuario ? 'Convidando' : bloqueioAssinatura ? 'Assinatura bloqueada' : 'Convidar usuário'}
                  </Botao>
                </div>
                <p className="text-sm text-texto-suave lg:col-span-3">
                  {formularioUsuario.role === 'Professional'
                    ? 'O convite também cria o perfil clínico e libera a agenda pessoal após o primeiro acesso.'
                    : 'Link de primeiro acesso enviado por email.'}
                </p>
              </form>
            ) : null}

            {podeGerenciarConvites ? (
              <section
                id="convites-usuarios"
                className="rounded-md border border-linha bg-superficie"
                aria-busy={carregandoConvites}
              >
                <div className="flex flex-col gap-2 border-b border-linha px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <MailCheck size={16} className="text-primaria" />
                    <div>
                      <h3 className="text-sm font-semibold">Convites pendentes</h3>
                      <p className="mt-1 text-xs text-texto-suave">
                        {convites ? `${convites.total} convites aguardando primeiro acesso` : 'Carregando convites'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-linha">
                  {convites?.itens.length ? (
                    convites.itens.map((convite) => (
                      <div
                        key={convite.id}
                        className="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[1fr_150px_160px_180px] lg:items-center"
                      >
                        <div className="min-w-0">
                          <p className="break-all font-medium">{convite.email}</p>
                          <p className="mt-1 text-xs text-texto-suave">{rotuloPapel(convite.role)}</p>
                        </div>
                        <span>{convite.status}</span>
                        <span>Expira em {formatarData(convite.expiraEm)}</span>
                        <div className="flex justify-end gap-1">
                          <Botao
                            type="button"
                            variante="fantasma"
                            onClick={() => void reenviarConvite(convite.usuarioId, convite.email)}
                            disabled={acaoConviteUsuarioId === convite.usuarioId}
                            aria-label={`Reenviar convite para ${convite.email}`}
                          >
                            <Send size={16} />
                          </Botao>
                          <Botao
                            type="button"
                            variante="fantasma"
                            onClick={() =>
                              setConfirmacaoUsuario({ tipo: 'revogar', id: convite.usuarioId, email: convite.email })
                            }
                            disabled={acaoConviteUsuarioId === convite.usuarioId}
                            aria-label={`Revogar convite de ${convite.email}`}
                          >
                            <Ban size={16} />
                          </Botao>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-sm text-texto-suave">Nenhum convite administrativo pendente.</div>
                  )}
                </div>
              </section>
            ) : null}

            {podeGerenciarConvites ? (
              <section
                id="historico-convites"
                className="rounded-md border border-linha bg-white"
                aria-busy={carregandoHistoricoConvites}
              >
                <div className="flex flex-col gap-3 border-b border-linha px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-center gap-2">
                    <History size={16} className="text-texto-suave" />
                    <div>
                      <h3 className="text-sm font-semibold">Histórico de convites</h3>
                      <p className="mt-1 text-xs text-texto-suave">
                        {historicoConvites
                          ? `${formatarQuantidade(historicoConvites.total, 'evento de convite', 'eventos de convite')}`
                          : 'Carregando histórico operacional'}
                      </p>
                    </div>
                  </div>
                  <a
                    href="/api/cliente/usuarios/convites/historico/exportar.csv"
                    className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md border border-linha bg-superficie px-3 text-sm font-medium text-texto-forte hover:bg-white"
                  >
                    <Download size={16} />
                    Exportar CSV
                  </a>
                </div>
                <div className="divide-y divide-linha">
                  {historicoConvites?.itens.length ? (
                    historicoConvites.itens.map((convite) => (
                      <div
                        key={convite.id}
                        className="grid gap-3 px-4 py-3 text-sm lg:grid-cols-[1fr_140px_180px_1fr] lg:items-center"
                      >
                        <div className="min-w-0">
                          <p className="break-all font-medium">{convite.email}</p>
                          <p className="mt-1 text-xs text-texto-suave">{rotuloPapel(convite.role)}</p>
                        </div>
                        <span className="w-fit rounded-md border border-linha bg-superficie px-2 py-1 text-xs font-semibold uppercase text-texto-suave">
                          {convite.status}
                        </span>
                        <span>{descreverHistoricoConvite(convite)}</span>
                        <span className="text-xs text-texto-suave">
                          Criado em {formatarData(convite.criadoEm)}
                          {convite.motivoRevogacao ? ` · Motivo: ${convite.motivoRevogacao}` : ''}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-sm text-texto-suave">Nenhum histórico de convite registrado.</div>
                  )}
                </div>
              </section>
            ) : null}

            {podeLerUsuarios ? (
              <div className="overflow-x-auto rounded-md border border-linha bg-white">
                <div className="min-w-[760px]">
                  <div className="grid grid-cols-[1.4fr_190px_100px_120px_150px] gap-3 border-b border-linha px-4 py-3 text-xs font-semibold uppercase text-texto-suave">
                    <span>Email</span>
                    <span>Papel</span>
                    <span>Situação</span>
                    <span>Último login</span>
                    <span>Acesso</span>
                  </div>
                  <div className="divide-y divide-linha">
                    {usuarios?.itens.length ? (
                      usuarios.itens.map((usuario) => (
                        <div
                          key={usuario.id}
                          className="grid grid-cols-[1.4fr_190px_100px_120px_150px] gap-3 px-4 py-3 text-sm"
                        >
                          <span className="break-all font-medium">{usuario.email}</span>
                          <div className="grid gap-2">
                            {usuario.role === 'Client' ? (
                              <span>{rotuloPapel(usuario.role)}</span>
                            ) : (
                              <>
                                <select
                                  className="h-9 rounded-md border border-linha bg-white px-2 text-sm"
                                  aria-label={`Permissão de ${usuario.email}`}
                                  value={papeisUsuarios[usuario.id] ?? usuario.role}
                                  disabled={!podeAjustarUsuarios || ajustandoUsuarioId === usuario.id}
                                  onChange={(evento) =>
                                    setPapeisUsuarios((atual) => ({
                                      ...atual,
                                      [usuario.id]: evento.target.value as PapelUsuarioClienteCriavelApi
                                    }))
                                  }
                                >
                                  <option value="Collaborator">Equipe administrativa</option>
                                  <option value="Professional">Profissional</option>
                                </select>
                                {(papeisUsuarios[usuario.id] ?? usuario.role) === 'Professional' &&
                                usuario.role !== 'Professional' ? (
                                  <input
                                    className="h-9 rounded-md border border-linha bg-white px-2 text-sm"
                                    aria-label={`Nome profissional de ${usuario.email}`}
                                    placeholder="Nome profissional"
                                    value={nomesProfissionais[usuario.id] ?? ''}
                                    onChange={(evento) =>
                                      setNomesProfissionais((atual) => ({
                                        ...atual,
                                        [usuario.id]: evento.target.value
                                      }))
                                    }
                                  />
                                ) : null}
                              </>
                            )}
                          </div>
                          <span>{usuario.ativo ? 'Ativo' : 'Inativo'}</span>
                          <span>{formatarData(usuario.ultimoLoginEm)}</span>
                          <div className="flex justify-end gap-1">
                            {usuario.role !== 'Client' ? (
                              <Botao
                                type="button"
                                variante="fantasma"
                                onClick={() => void ajustarPapelUsuario(usuario.id, usuario.role)}
                                disabled={
                                  !podeAjustarUsuarios ||
                                  ajustandoUsuarioId === usuario.id ||
                                  (papeisUsuarios[usuario.id] ?? usuario.role) === usuario.role ||
                                  ((papeisUsuarios[usuario.id] ?? usuario.role) === 'Professional' &&
                                    usuario.role !== 'Professional' &&
                                    !nomesProfissionais[usuario.id]?.trim())
                                }
                                aria-label={`Salvar acesso de ${usuario.email}`}
                              >
                                <Save size={16} />
                              </Botao>
                            ) : null}
                            <Botao
                              type="button"
                              variante="fantasma"
                              onClick={() =>
                                setConfirmacaoUsuario({ tipo: 'desativar', id: usuario.id, email: usuario.email })
                              }
                              disabled={
                                !podeDesativarUsuarios ||
                                !usuario.ativo ||
                                usuario.role === 'Client' ||
                                desativandoUsuarioId === usuario.id
                              }
                              aria-label={`Desativar ${usuario.email}`}
                            >
                              <Trash2 size={16} />
                            </Botao>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-8 text-sm text-texto-suave">
                        Nenhum usuário administrativo carregado.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </Cartao>
      ) : null}
    </>
  );
}
