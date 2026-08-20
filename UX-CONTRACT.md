# UX Contract

## Product context

- Audience: profissionais, colaboradores, pacientes, gestores de clinica e SuperAdmin.
- Primary jobs: atender, acompanhar pacientes, gerir agenda e comunicacoes sem expor dados fora do escopo.
- Target market(s): Brasil.
- Active locales: `pt-BR`.
- Language/content register and native-review policy: portugues brasileiro direto, com revisao de texto em toda superficie alterada.
- Timezone/calendar policy: `America/Sao_Paulo` como fuso operacional padrao; o backend continua autoridade para agenda.
- Accessibility target: WCAG 2.2 AA.

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Permission model | `MAPA_ROTAS_PERMISSOES.md` | policy | 2026-08-20 |
| Tenant and session | `DECISOES_ARQUITETURA.md` ADR-002, ADR-004, ADR-005 | ADR | 2026-08-20 |
| Deletion and retention | `DECISOES_ARQUITETURA.md` ADR-008 and `fase-236-exames-evolucao-fotografica.md` | ADR/spec | 2026-08-20 |
| Billing | `fase-224-oferta-comercial-ativacao-assistida.md` | product spec | 2026-08-20 |
| Legal copy | `POLITICA_PRIVACIDADE_RASCUNHO.md`, `TERMO_DE_USO_RASCUNHO.md` | legal draft | 2026-08-20 |

## Visual contract

- Project `DESIGN.md`: source of visual intent.
- Token ownership model: runtime canonical.
- Runtime design-system/token source: `octaclin-web/tailwind.config.ts` and `octaclin-web/app/globals.css`.
- Mapping/export/adapters: shared components in `octaclin-web/components/ui` consume Tailwind semantic tokens.
- Token drift gate: Fase 247 runs the frontend-design audit plus lint, typecheck and Playwright.
- Supported themes: light; high-contrast and reduced motion follow browser preferences.
- Design-context owner/review policy: any shared visual change updates this file and `DESIGN.md` in the same phase.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Select/Listbox | `Selecao` | `components/ui/campo.tsx` | native only until an authored need is approved | keyboard + visual |
| Date | native `Campo type=date` | `components/ui/campo.tsx` | native | locale + browser |
| Form | `Campo`, `AreaTexto`, `Selecao`, `Rotulo` | `components/ui/campo.tsx` | create / edit | validation E2E |
| Scrollbar | application stylesheet | `app/globals.css` | geometry exceptions only | computed style |
| Feedback | `Aviso`, `AlertaOperacional`, `EstadoVazio` | `components/ui/feedback.tsx` | success / warning / info / error | live-region test |
| CRUD confirmation | `ModalConfirmacao` | `components/ui/modal.tsx` | destructive confirmation | keyboard + E2E |
| Tables and lists | `Tabela` | `components/ui/tabela.tsx` | grid/list presentation | responsive E2E |

## Component behavior

| Component | Default | Hover | Focus | Active | Disabled | Busy | Error |
|---|---|---|---|---|---|---|---|
| Button | stable 44px action | visual emphasis | double focus ring | 1px movement | muted, no pointer | spinner, same geometry | inline alert when recoverable |
| Input/select | bordered white surface | no false affordance | visible ring | native typing/selection | muted | submit owns busy state | text plus `aria-invalid` |
| Textarea | fixed resize policy | n/a | visible ring | native editing | muted | submit owns busy state | text plus `aria-invalid` |
| Table/list | bounded data surface | row only when actionable | keyboard target visible | explicit action | n/a | stable loading region | empty/no-result/alert |

## Dataset navigation

- Admin tables: server pagination where the API supports it.
- Exploratory lists: explicit pagination or "Carregar mais"; no implicit infinite scroll.
- URL state: committed search and filters use search parameters where already supported; sensitive or unsaved form state does not.
- Empty/no-results/error/loading treatment: `EstadoVazio`, `AlertaOperacional` and `BarraCarregamento` distinguish each condition.

## Flow ledger

| Operation | Trigger | Pending | Success destination | Success feedback | Failure recovery | Focus outcome | Source ref |
|---|---|---|---|---|---|---|---|
| Save draft | primary button | button busy | remain in editor | inline success | retain values and show inline error | action remains reachable | existing clinical forms |
| Archive | explicit destructive action | confirmation busy | remain in current list | inline success | retain selected item and show error | restore to trigger | ADR-008 |
| Search | input/filter | loading region | same list | updated result count | retain query and retry | search remains focused | list components |
| Upload | explicit submit | progress/busy action | same patient context | confirmed state | retain non-secret metadata | upload action remains reachable | ADR-018 |

## Navigation and responsive behavior

- Route document title policy: each new or touched route must expose an honest Portuguese title.
- Route error / 403 page behavior: global error uses product copy and retry; permission states explain the missing capability without exposing data.
- Sidebar/drawer/bottom-sheet transformation: shells own responsive navigation; feature screens do not add competing fixed navigation.
- Responsive table strategy: `Tabela` owns horizontal overflow; forms keep document scrolling.
- Focus restoration and sticky-obstruction policy: `Modal` restores trigger focus; sticky surfaces must preserve visible focus with scroll margin.

## Overlays and feedback

- Dialog primitive: `Modal` and `ModalConfirmacao` only; browser dialogs are prohibited.
- Destructive confirmation levels: archive/delete/consent revocation require named confirmation; routine saves do not.
- Toast placement/duration/deduplication: `AvisoRegiao` only acknowledges; actionable recovery remains inline.
- Unsaved-changes behavior: editing flows with drafts must warn before discard when a reliable dirty state exists.

## Async and resilience

- Mutation default: pessimistic request with explicit busy state.
- Idempotency and duplicate-submit policy: busy actions disable repeat submits; backend remains authority for idempotent external effects.
- Session expiry/re-authentication: BFF preserves the trusted boundary and returns the login flow without exposing tokens.
- Stale-request cancellation/invalidation: remote search and refreshes must avoid replacing newer state with older responses.

## Validation

- Schema/validation layer: backend DTO/domain remains authority; frontend gives immediate correction guidance where available.
- Server error mapping: display a user-actionable Portuguese message without backend internals.
- Sensitive-value handling: no secret, token or clinical payload enters URL, toast, browser console or UI error.
- Forms use labels, inline error text, `aria-invalid` where invalid, duplicate-submit prevention and preserved values after recoverable failure.

## Permission and clipboard

- Permission UI strategy: hide unavailable navigation/actions by permission; show explicit denied state only when a route is reached without capability.
- Clipboard copy policy: only explicit copy controls; secrets and temporary tokens are never repeated in a toast.

## Migration status

- Migration ledger location: `fase-247-qualidade-interface-linguagem.md`.
- Canonical primitives and owners: the Canonical UI Map above.
- Current risk-prioritized slices: shell/copy, shared controls/feedback, then agenda/pacientes/prontuario.
- Legacy removal gate: raw form controls are migrated when a touched workflow reaches parity in label, focus, error and mobile behavior.

## Verification

- Required static commands: `pnpm --dir octaclin-web lint`, `typecheck`, `test:a11y`, `test:authz`, `build`.
- Browser/device matrix: desktop 1440px and mobile 390px for shell, agenda, pacientes, prontuario and portal.
- Project audit command/result: frontend-design premium audit in report and strict mode after the contract lands.
