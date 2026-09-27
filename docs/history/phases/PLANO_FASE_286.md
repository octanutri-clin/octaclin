# Fase 286 — modelos clínicos e IMC calculado

## Decisão e escopo

O PR #321 integrou o PB-20. A próxima recomendação da auditoria é completar
modelos profissionais e o uso de medidas da mesma consulta. Nesta fase serão
entregues modelos reutilizáveis para observações antropométricas e texto do
relatório de alta, além do fluxo existente de modelos de evolução e conduta.
Atestados e encaminhamentos exigem decisão de produto posterior.

O IMC estruturado resulta exclusivamente de peso em kg e altura em cm, pela
fórmula `pesoKg / (alturaCm / 100)^2`. Ele não é entrada do formulário nem do
DTO; o backend é a fonte de verdade. A interface mostra o valor derivado e a
classificação automaticamente após preencher as duas medidas, quando há dados
suficientes. As seis faixas adultas (20–59 anos) são: baixo peso `<18,5`,
eutrofia `[18,5,25)`, sobrepeso `[25,30)`, obesidade grau 1 `[30,35)`, grau 2
`[35,40)` e grau 3 `>=40`. A classificação usa o valor sem arredondar; a
exibição usa duas casas.

Menores de 20 anos não recebem a faixa adulta. Para pessoas de 60 anos ou
mais permanece o critério de Lipschitz/SISVAN já aplicado. Pacientes marcadas
como gestantes no perfil não recebem faixa adulta. Critérios de IMC por idade
e sexo para crianças/adolescentes e por semana gestacional para gestantes
serão planejados em PRs próprios.

O perfil atualmente informa somente a condição biológica vigente; não guarda
histórico de início/fim da gestação nem semana gestacional. Para avaliações
retrospectivas, a classificação usa o perfil conhecido no registro, com aviso
de limitação temporal. A fase futura de gestantes deve obter idade gestacional
na data da medida e contexto pré-gestacional antes de classificar. A fase
pediátrica deve usar idade precisa e sexo, com curvas OMS 0–5 anos e referência
5–19 anos, em vez de aplicar as seis faixas adultas.

## Plano de execução

1. Ampliar a biblioteca cifrada de modelos existente para as duas finalidades
   textuais novas, preservando origem pessoal/clínica, filtros no servidor,
   auditoria e o contrato anterior de modelos de evolução. Usar a tabela
   existente, sem migration; nenhum modelo novo contém dados reais.
2. Integrar seleção, aplicação, criação e arquivamento dos modelos nas abas de
   antropometria e documentos. Aplicar apenas ao rascunho local; o profissional
   revisa antes de salvar/emitir.
3. Mostrar IMC derivado no formulário sem campo editável e manter o cálculo
   definitivo no backend. Não permitir que o cliente envie IMC ou sua
   classificação como entrada estruturada. Exibir a classificação apropriada
   e avisos para faixas não aplicáveis.
4. Ligar a evolução à avaliação selecionada da mesma consulta sem copiar IMC
   para um campo editável. Mostrar como dado somente leitura quando a consulta
   selecionada possui avaliação, preservando o vínculo opcional já entregue pelo
   PB-24 e a autoria do registro.
5. Reconciliar status, checklist e auditoria no mesmo PR.

## Risco e gates

R4 por dado clínico e autorização multi-tenant. Nenhum DDL, migration ou ação
de produção. Rollback: revert do PR; registros já emitidos/assinados e
avaliações append-only mantêm o snapshot histórico. Revisão cruzada focará
escopo pessoal/clínica, carteira, perfil de gestação e ausência de IMC manual.
Typecheck, build, preflight documental, diff e scanner de secrets serão
registrados com PASS/FAIL/NA/SKIPPED. Os checks do PR são evidência separada.

## Evidência local e limites

- PASS: typecheck e build de backend e web; lint web sem erros (62 avisos);
  `pnpm validate:docs`, `git diff --check` e `pnpm security:secrets`.
- SKIPPED: testes locais, por instrução do ciclo; a suíte automática inicia no PR.
- NA: migration, DDL, execução em staging/produção e deploy.
- Limite de ambiente: validações locais rodaram com Node 24.19.0; o repositório
  declara Node 22 como runtime suportado. O CI em Node 22 é o gate autoritativo.
- Revisão independente: pendente de revisão humana na PR; não foi executada
  revisão cruzada por outro agente neste ciclo.

## Referências clínicas

- Ministério da Saúde, obesidade no adulto: https://linhasdecuidado.saude.gov.br/portal/obesidade-no-adulto/unidade-de-atencao-primaria/rastreamento-diagnostico/
- Ministério da Saúde, gestante por semana gestacional: https://linhasdecuidado.saude.gov.br/portal/obesidade-no-adulto/unidade-de-atencao-primaria/planejamento-terapeutico/avaliacao-da-gestante/
- OMS, IMC por idade 5–19 anos: https://www.who.int/toolkits/growth-reference-data-for-5to19-years/indicators/bmi-for-age
- OMS, padrões de IMC por idade do nascimento aos 5 anos: https://www.who.int/toolkits/child-growth-standards/standards/body-mass-index-for-age-bmi-for-age
