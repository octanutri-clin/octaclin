# FOOD06 P3-4a — ações protegidas sobre restrição confirmada (web, R4)

- **Plano:** `tasks/food06-p3-plano.md` (§1 P3-4, §5, Q3, Q-I e NUX-01 da etapa A).
- **Dependências:** rotas da P2 (`:restricaoId/inativar` e `:restricaoId/reavaliar`) e a aba da P3-3. Sem mudança no backend.
- **Escopo:** sem migration. Flag `OCTACLIN_WEB_RESTRICOES_CLINICAS` desligada por padrão. Mobile segue NO-GO.
- **Divisão:** a P3-4 foi dividida. Esta fatia traz reavaliar, inativar em dois passos e "Corrigir registro". A reconfirmação de
  180 dias (global e individual, aviso e declarar ausência) fica na **P3-4b**.

## O que entrou

- **BFF** (`lib/server/restricoes-prontuario-bff.ts`)
  - **Rotas:** `/api/pacientes/:id/restricoes/:restricaoId/{inativar, reavaliar}`.
  - **Permissão:** só a permissão grossa, igual à do backend: `pacientes.ler` + `pacientes.gerenciar`.
  - **Quem decide:** proteção da alergia confirmada, concessão `restricoes.confirmar`, carteira e delegação são do backend, sob lock.
  - **Corpo exato** (`montarInativacaoRestricao`, `montarReavaliacaoRestricao`):
    - motivo da lista do contrato;
    - justificativa com até 1000 caracteres e sem caractere de controle, que é a regra real do domínio (F5; o DTO diz 4000);
    - quebras de linha viram espaço;
    - destino só `ativa` ou `em_reavaliacao`.
  - **Resposta conferida** (`projetarEstadoRestricao`): mesma restrição, revisão seguinte e estado pedido. Só id, revisão e estado
    voltam.
  - **`confirmacaoEmDoisPassos: true`:** é atestação da interface, enviada só pelo botão do segundo passo, por decisão do proprietário
    (sem reautenticação). Não é prova: qualquer cliente autenticado com a permissão pode afirmá-la. O controle real continua no
    backend.
- **Tela** (`components/pacientes/acoes-restricao-confirmada.tsx`, na aba "Restrições")
  - **Quem vê as ações:** só o profissional com a permissão clínica (escopo `completo`), e só em restrição confirmada, ativa ou em
    reavaliação.
  - **Reavaliar:** "Marcar para reavaliação" e "Manter como confirmada", com diálogo. A restrição continua valendo durante a
    reavaliação.
  - **Inativar em dois passos (Q3):**
    1. motivo e justificativa;
    2. a frase "Você está inativando {tipo} confirmada: {alimento}. O histórico é preservado.", com o motivo escolhido, o aviso de que
       o paciente deixa de ver a restrição no portal sem aviso automático e, se a conferência geral estiver em dia, o aviso de que
       ela volta a "não conferida". O botão é "Inativar {tipo}".
    - Em 409 ou resultado incerto, a lista é recarregada e o diálogo volta ao passo 1 com o texto preservado (só em memória).
    - Caracteres invisíveis são recusados no navegador, com mensagem própria.
  - **"Corrigir registro" (NUX-01, Q-I):**
    1. registra a corrigida, com o formulário vindo da anterior (inclusive a observação);
    2. confirma a corrigida;
    3. inativa a anterior em dois passos, com a anterior identificada por gravidade e data.
    - Cada passo é um clique e, depois de cada um, a lista é recarregada.
    - Antes de inativar a anterior, e antes de anunciar "concluída", a tela confere de novo que a corrigida continua confirmada
      (R4 MÉDIA).
    - Se um passo falha ou se a pessoa para, a anterior continua valendo e a tela diz em que passo parou e como concluir.
    - Só aparece para alimento em texto livre: um item de catálogo perderia o vínculo.
  - **Recargas:** só a mais recente pinta a lista.

## Provas

- **Unitários e BFF:** `scripts/restricoes-acoes-protegidas.spec.ts`, encadeado em `test:authz` via `test:restricoes:bff`.
- **Playwright:** `food06-restricoes-prontuario.spec.mjs`, bloco "P3-4a", em desktop e mobile, com axe nos diálogos.
- **Matriz de acessibilidade:** gate `web-food06-restricoes-prontuario`, com a descrição atualizada.
- **UX B:** `docs/agents/ux/reports/FOOD06-P3-4a-B-2026-11-20/`.

## Revisão R4 (`tenant-security-reviewer`, mesmo modelo, não independente)

- **Resultado:** nenhum achado ALTA. Um MÉDIA e seis BAIXA.
- **MÉDIA 1 (corrigido, com teste):** a anterior era inativada sem conferir de novo que a corrigida ainda valia (corrida com outra
  aba). Agora a tela confere antes de enviar e antes de anunciar a conclusão.
  - **Janela residual:** entre essa conferência e a inativação ainda há uma janela pequena. Fechá-la exige uma operação atômica de
    "substituir" no backend, registrada como dívida.
- **BAIXA corrigidas:**
  - 2: aviso de que a conferência geral volta a "não conferida";
  - 3: fechamento bloqueado durante o registro, e o texto do passo 1 sem ambiguidade;
  - 4: "Corrigir" só para texto livre;
  - 5: caracteres invisíveis recusados no navegador;
  - 6: sequência nas recargas.
- **BAIXA 7 (aceita):** `confirmacaoEmDoisPassos` é atestação da interface, registrada acima e na PR.
- **Teste novo:** paciente inválido nas duas rotas novas.

## Fora desta fatia

- **P3-4b:** reconfirmação de 180 dias.
- **P3-5:** solicitações do paciente.
- **Vínculo "correção de":** a pendente corrigida não mostra de qual restrição é correção; exige backend.
- **"Substituir" atômico no backend:** dívida que fecha a janela residual da R4 MÉDIA.
