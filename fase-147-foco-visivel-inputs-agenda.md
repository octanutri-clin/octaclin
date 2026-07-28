# Fase 147 - Foco visivel explicito nos inputs crus da agenda

Status: entregue em 2026-07-27.

## Objetivo

Endereçar de forma explicita o achado registrado na Fase 146 ("Limitacoes
conhecidas"): os inputs nativos de `components/agenda/painel-agenda.tsx`
nao tinham classe `focus-visible` propria e dependiam apenas da regra
global `:focus-visible` em `app/globals.css`, trazida incidentalmente pelo
merge da Fase 144. Sem uma classe propria, a agenda ficava fragil a uma
futura remocao/sobrescrita dessa regra global.

## Escopo

Unico arquivo alterado: `octaclin-web/components/agenda/painel-agenda.tsx`.

Adicionada a classe `focus-visible:outline focus-visible:outline-2
focus-visible:outline-offset-2 focus-visible:outline-primaria` — o mesmo
padrao ja usado em `components/app/portal-shell.tsx` e
`components/ui/modal.tsx` — aos 4 inputs crus que nao passam pelo
componente compartilhado `Campo`:

- checkbox "Enviar e-mail e mensagem ao salvar" (formulario de criacao).
- "Nova data e hora", "Nova duracao" e "Novo local" (formulario de
  remarcar consulta).

Nenhuma logica, dado ou rota foi alterada.

## Validacoes

```powershell
pnpm --dir octaclin-web typecheck   # limpo
pnpm --dir octaclin-web lint        # limpo
pnpm --dir octaclin-web test:a11y   # 10 passed (5 rotas x 2 projetos)
```

## Observacao

A regra global de `:focus-visible` em `globals.css` continua ativa e
cobre o restante do app (incluindo os componentes compartilhados `Campo`,
`AreaTexto`, `Selecao` e `Botao`, que tambem nao tem classe propria). Esta
fase tratou apenas o caso ja identificado e documentado na Fase 146; se o
gate de acessibilidade (`pnpm test:a11y`) encontrar novos elementos sem
foco visivel no futuro, o mesmo padrao de classe deve ser aplicado no
ponto especifico do achado.
