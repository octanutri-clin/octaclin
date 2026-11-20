# FOOD06 P3-3 — aba "Restrições" no prontuário (web, R4)

- **Plano:** `tasks/food06-p3-plano.md` (§1 P3-3, §2 a §5).
- **Dependências:** usa as leituras da P3-0a (#559) e as rotas da P2.
- **Escopo:** sem migration. Flag `OCTACLIN_WEB_RESTRICOES_CLINICAS` desligada por padrão.
- **Mobile:** NO-GO. Esta PR é web responsiva, não o app.

## O que entrou

- **BFF** (`lib/server/restricoes-prontuario-bff.ts`)
  - **Rotas do profissional:** `/api/pacientes/:id/restricoes/{listar, avaliacao, avaliacao/iniciar, registrar, :restricaoId/confirmar, :restricaoId/rejeitar}`.
  - **Rotas do colaborador:** `/api/colaborador/pacientes/:id/restricoes/{listar, registrar}`.
  - **Permissão grossa, igual à do backend:**
    - leitura: `pacientes.ler`;
    - escritas do profissional: `pacientes.ler` + `pacientes.gerenciar`;
    - registro do colaborador: `pacientes.ler`.
  - **Montagem do conteúdo:** o BFF monta o conteúdo do contrato (`lib/restricoes-prontuario.ts`).
    - O alvo é `nao_catalogado` com o texto do alimento, porque não há catálogo (F10).
    - Em restrição clínica, a gravidade padrão é "não informada", explícita (NUX-11). Em escolha alimentar, não há gravidade.
    - Quebras de linha na observação viram espaço (NUX-12).
    - A marca do paciente nunca vem da equipe.
  - **Validação das respostas:**
    - A lista passa por allowlist e falha fechado se algum item vier inválido.
    - Confirmar e rejeitar conferem o id e a revisão seguinte na resposta.
- **Quem decide o quê**
  - Papel, carteira, delegação e a concessão `restricoes.confirmar` são verificados no backend, sob lock.
  - O `escopo` da lista (`completo` ou `autoria`) só orienta a tela.
  - A tela escolhe a rota do colaborador pelo papel da sessão, apenas como indicação.
- **Aba "Restrições"** (`components/pacientes/aba-restricoes.tsx`), na área "Plano":
  - **Quando aparece:** só com a área ligada na web e no tenant. Usa a mesma consulta do atalho de representantes, então o orçamento do prontuário não muda (continua em 6).
  - **Aviso fixo:** os registros ainda não geram alerta automático no plano alimentar.
  - **Organização da lista:** grupos "Para conferir" (primeiro), "Confirmadas", "Em reavaliação" e "Inativas e rejeitadas" (recolhível).
  - **Informação mostrada por item:**
    - "Tipo não informado pelo paciente" (NUX-24);
    - observação da equipe, origem e data;
    - nunca ids nem valores técnicos.
  - **Confirmar:** com diálogo. **Rejeitar:** justificativa obrigatória, só a equipe vê.
  - **Depois de qualquer escrita:** a lista é recarregada e o resultado é anunciado em região viva, inclusive em 409 e em resultado incerto.
  - **Registrar:** foco no primeiro campo inválido. A chave de criação é reaproveitada depois de um resultado incerto, então repetir não duplica.
  - **Conferência geral:** mostra a situação com datas e, se ainda não existir, permite iniciá-la (avaliação inicial).
  - **Colaborador e profissional sem a permissão clínica:** veem só os próprios registros, com texto próprio (NUX-02), e não têm ações de conferência.

## Provas

- **Unitários:** `scripts/restricoes-prontuario.spec.ts` e `scripts/restricoes-prontuario-bff.spec.ts`, encadeados em `test:authz` via `test:restricoes:bff`.
- **Playwright:** `food06-restricoes-prontuario.spec.mjs` em desktop e mobile, com axe e reflow a 320 px.
- **Matriz de acessibilidade:** gate `web-food06-restricoes-prontuario`.

## Fora desta fatia

- **P3-4:** reavaliar, inativar em dois passos, "corrigir registro" (NUX-01) e reconfirmação de 180 dias.
- **P3-5:** solicitações do paciente.
- **Catálogo de alimentos:** sem catálogo, o alimento continua como texto livre.
