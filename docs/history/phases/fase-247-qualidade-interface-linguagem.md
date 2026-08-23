# Fase 247 - Qualidade de interface e linguagem

## Objetivo

Estabilizar a fundação visual e a linguagem do OctaClin antes de ampliar o
produto ou iniciar o piloto. A fase corrige elementos compartilhados, elimina
texto sem acentuação em superfícies de alto tráfego e cria contratos para
impedir novos desvios entre telas.

## Escopo concluído

1. Criados `DESIGN.md` e `UX-CONTRACT.md`, ancorados nos tokens e componentes
   existentes, sem introduzir um segundo sistema visual.
2. Padronizados scrollbar, placeholder e altura mínima de 44 px para campos
   compartilhados, preservando o indicador nativo dos selects.
3. Corrigida a linguagem visível do shell, erros globais, feedback, cadastro
   do paciente e exames laboratoriais para português brasileiro.
4. Corrigida a divergência de hidratação que a agenda criava ao calcular a URL
   de exportação com `Date.now()` durante a renderização. A URL agora é criada
   somente após a hidratação e permanece inacessível até então.
5. Corrigido o cálculo da próxima consulta no prontuário para não depender de
   relógio durante a renderização do servidor.
6. Registrado o inventário de 148 controles HTML locais para migração gradual.
   Eles não serão substituídos cegamente em um único diff.

## Fora de escopo

- regras clínicas, contratos de backend, permissões, tenant, dados ou migrations;
- rebrand, tema escuro e redesign de marketing;
- alteração de texto jurídico pendente de revisão profissional;
- refatoração dos fluxos clínicos completos, planejada nas Fases 248 e 249.

## Validação

- `pnpm --dir octaclin-web lint`: aprovado, com 53 avisos pré-existentes e
  nenhum erro;
- `pnpm --dir octaclin-web typecheck`: aprovado;
- `pnpm --dir octaclin-web build`: aprovado;
- `pnpm --dir octaclin-web test:base-visual`: aprovado;
- `playwright test tests/visual/acessibilidade.spec.mjs --workers=2`: 10/10
  aprovado em desktop e mobile.
- `playwright test tests/visual/console-regression.spec.mjs --grep "console operacional" --workers=2`:
  20/20 aprovado em desktop e mobile.

O teste de acessibilidade deixou de registrar a divergência de hidratação da
URL de exportação da agenda após a correção. Os avisos restantes de efeitos
com `setState` serão priorizados por fluxo na Fase 248, pois exigem revisão de
comportamento e não simples alteração visual.

## Próximas fases

- **Fase 248:** recuperar os estados carregando, vazio, erro e permissão das
  superfícies clínicas, começando por agenda, pacientes e prontuário.
- **Fase 249:** reduzir densidade, revisar responsividade e migrar controles
  locais desses mesmos fluxos para os componentes compartilhados.
