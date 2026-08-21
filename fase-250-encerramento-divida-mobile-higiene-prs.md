# Fase 250 - Encerramento da divida Mobile e higiene de PRs

Concluida em 2026-08-20.

## Objetivo

Revalidar a divida residual de seguranca do aplicativo Expo, reconciliar o PR
legado `#6` com o codigo atual e deixar o GitHub sem PRs abandonados. Esta fase
nao ativa nem libera o Mobile.

## Matriz requisito-evidencia

| Requisito ou risco | Evidencia verificada | Resultado |
| --- | --- | --- |
| Patch para `image-size` | GitHub Advisory Database para `GHSA-w3rx-r6r6-pgpr` e `GHSA-5p2g-fcmc-qvqq`; npm `latest=2.0.2` | Os dois advisories altos afetam `<=2.0.2` e continuam sem primeira versao corrigida |
| Presenca no projeto | `pnpm --dir octaclin-mobile why image-size` | Dependencia transitiva `image-size@1.2.1`, trazida por `metro@0.84.4` na matriz Expo 57 |
| Gate fail-closed | `audit-seguranca-lib.mjs` e seus seis testes | Somente os dois GHSAs, versao, caminho, severidade e metadados exatos sao admitidos; qualquer divergencia reprova |
| Escopo Mobile do PR `#6` | Servico e testes atuais de Mobile | Tenant, paciente, profissional responsavel e idempotencia por paciente permanecem protegidos |
| Escopo IA do PR `#6` | Servico e testes atuais de IA | Escopo clinico, referencias, midia confirmada, hash, lock transacional, timeout e erros sanitizados superam o desenho legado |
| Higiene do GitHub | PR `#6` estava `CONFLICTING`, sem revisao e com smoke historico falho | Comentario de reconciliacao publicado e PR encerrado como superado; nenhum PR aberto restou |
| Distribuicao Mobile | Feature flag fail-closed e gates locais | `mobile.sync` permanece desabilitada por padrao e o Mobile continua NO-GO |

O Context7 foi consultado para a biblioteca, mas nao fornece notas de seguranca
que resolvam esses advisories. A decisao usa como fontes atuais o GitHub
Advisory Database, a API de alertas do repositorio e o registro npm.

## Validacoes locais

- instalacao Mobile com lockfile congelado;
- TypeScript sem erros;
- Expo Doctor e alinhamento de dependencias aprovados;
- seis testes do avaliador de auditoria aprovados;
- auditoria aprovada somente pelas duas excecoes upstream exatas;
- export de producao Android, iOS e web aprovado;
- quatro suites e 42 testes direcionados de servicos/controladores Mobile e IA
  aprovados;
- nenhuma alteracao de codigo, migration, banco ou producao.

## Decisao de seguranca

A Fase 250 encerra a reconciliacao e a higiene de PRs, mas nao declara a divida
upstream eliminada. Os dois alertas altos continuam rastreados e bloqueiam a
distribuicao. Nao foi aplicado override para `image-size@2.0.2`, pois essa
versao tambem esta na faixa vulneravel e nao produziria reducao real de risco.

## Proxima fase

Fase 251 - Revisao integral de linguagem e microcopy.

- Modelo: GPT-5.6 Sol, raciocinio `medium`.
- Skills: `ecc:brand-voice`, `ecc:frontend-a11y`,
  `ecc:make-interfaces-feel-better` e `ecc:browser-qa`.
- Ferramentas: Browser e Playwright; Penpot somente quando a copia alterar
  dimensao ou hierarquia visual.
