# Validação clínica dos textos do portal de restrições (ATV-1, textos)

Contrato: `tasks/food06-m11-restricoes-contrato-v3.md`.

- **ATV-1** exige "validação documentada por versão" pelo responsável clínico.
- Este registro cobre a parte de **textos** do ATV-1.
- A taxonomia, as regras do motor, a gravidade e a política de 180 dias seguem no ATV-1 geral e não são cobertas aqui.

## Como funciona

- **Fonte de verdade:** os textos ficam em `octaclin-web/lib/textos-restricoes.ts`. A lista dos que exigem validação está em
  `octaclin-web/lib/textos-validacao-clinica.ts`.
- **Registro versionado:** `docs/clinico/validacao-textos-restricoes.json` guarda, para cada texto, o hash das variantes exatas e o
  status (`pendente` ou `aprovado`).
- **Controle automático:** `scripts/validacao-textos-clinicos.spec.ts`, que roda em `test:restricoes:bff` dentro de `test:authz`,
  falha em três casos:
  - o texto mudou e o hash não foi atualizado;
  - há texto sem registro;
  - há aprovação sem papel, data ou versão.
- **Mudança de texto:** ao mudar um texto, atualize o hash e volte o status para `pendente`, porque a aprovação valia para o texto
  anterior.
- **Ativação:** a ativação de `restricoes.clinicas` só é aceita com **todos** os textos `aprovado` (somado aos demais ATV).

## Como aprovar

1. O responsável clínico lê as variantes abaixo, que são uma cópia de conferência; o hash no registro é que vale.
2. Para aprovar sem mudanças: troque `"status": "pendente"` por `"aprovado"` e acrescente
   `"aprovacao": { "papel": "responsável clínico", "data": "AAAA-MM-DD", "versao": "<commit avaliado>" }`.
3. Para pedir mudança: altere o texto no código, rode o teste, copie o hash novo e mantenha `pendente`.
4. O registro não leva nome, CRN, e-mail nem outro dado pessoal. A identidade de quem aprovou fica no histórico da PR.

## Textos validados (cópia de conferência)

Aprovados pelo responsável clínico em 2026-11-20 sobre a versão `ca3f089f`, sem mudanças. O ATV-7 (compreensão com
pessoas) continua pendente para estes mesmos textos.

`{nome}` é o nome da pessoa acompanhada, mostrado ao responsável.

| Id | Finalidade | Conta própria | Responsável |
| --- | --- | --- | --- |
| `portal.urgencia` | Aviso de urgência ao informar uma restrição (NUX-27) | "Se você tiver uma reação forte agora, como falta de ar ou inchaço na boca ou na garganta, procure atendimento de urgência ou ligue 192 (SAMU)." | "Se {nome} tiver uma reação forte agora, como falta de ar ou inchaço na boca ou na garganta, procure atendimento de urgência ou ligue 192 (SAMU)." |
| `portal.informarSucesso` | Depois de informar uma restrição | "Enviamos a informação. Quem faz seu acompanhamento vai conferir. Em caso de dúvida ou sintomas, fale com quem faz seu acompanhamento." | "Enviamos a informação sobre {nome}. Quem faz seu acompanhamento vai conferir. Em caso de dúvida ou sintomas, fale com quem faz seu acompanhamento." |
| `portal.planoNaoMuda` | Registrar não altera o plano (PUX-03) | "Registrar uma restrição aqui não muda seu plano alimentar automaticamente. Se algo mudou, fale com quem faz seu acompanhamento." | "Registrar uma restrição aqui não muda o plano alimentar de {nome} automaticamente. Se algo mudou, fale com quem faz o acompanhamento." |

## Perguntas ao responsável clínico

- **Urgência:** a lista de sinais ("falta de ar ou inchaço na boca ou na garganta") e a orientação "192 (SAMU)" estão adequadas
  para todo o público, inclusive crianças acompanhadas por responsável?
- **Mensagem depois de informar:** "Em caso de dúvida ou sintomas, fale com quem faz seu acompanhamento" é suficiente, ou sintomas
  devem levar ao aviso de urgência?
- **Plano não muda:** o texto deixa claro que nada muda no plano até a equipe agir, sem gerar alarme?

## Textos pendentes (cópia de conferência)

| Id | Finalidade | Conta própria | Responsável |
| --- | --- | --- | --- |
| `portal.seloRevisada` | Informação rejeitada, visível por 30 dias (PUX-01/05, 2026-11-20) | "Revisada por quem faz seu acompanhamento. Se tiver dúvida, converse na próxima consulta." | "Revisada por quem faz o acompanhamento de {nome}. Se tiver dúvida, converse na próxima consulta." |
