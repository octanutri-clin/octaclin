# OctaClin — Fase 314 | Registro de aceite clínico do protocolo G02

**Situação:** RATIFICAÇÃO EXPRESSA PELO USUÁRIO/RESPONSÁVEL NESTA CONVERSA; formalização institucional e verificação do arquivo no repositório pendentes.

## 1. Identificação inequívoca do protocolo aceito

- **Documento:** `FASE_314_G02_PROTOCOLO_DECIDIDO_REV9.md`.
- **SHA-256 dos bytes do documento conferidos nesta sessão:** `3dd197dfa16dd235bda1573020cf0af04b3ae8699c2c21388a90d2bf670a201a`.
- **Escopo:** políticas CL-01 a CL-10, inclusive as decisões específicas nas seções 0–12 e os cenários A01–A20 da REV9.
- **Data da manifestação:** 2026-10-11, fuso America/Sao_Paulo (horário preciso não atestado neste registro).
- **Meio:** manifestação textual na conversa de ChatGPT, não assinatura eletrônica certificada nem ata institucional.

## 2. Manifestação recebida

Após o assistente apresentar ao usuário a seguinte declaração para aceite:

> Ratifico, na qualidade de nutricionista responsável pela avaliação do protocolo clínico da Fase 314 do OctaClin, as decisões CL-01 a CL-10 contidas no documento FASE_314_G02_PROTOCOLO_DECIDIDO_REV9.md, identificado pelo SHA-256 3dd197dfa16dd235bda1573020cf0af04b3ae8699c2c21388a90d2bf670a201a, dentro do meu âmbito de competência profissional.
>
> Aprovo essas regras como protocolo de implementação, reconhecendo as políticas locais e as limitações científicas explicitadas no documento.
>
> Esta ratificação não substitui a validação computacional G01, a comprovação dos direitos de utilização das referências, eventuais revisões especializadas exigidas pela governança, nem autoriza ativação assistencial ou implantação em produção.

O usuário respondeu de forma expressa:

> **Sim, ratifico integralmente.**

**Interpretação fiel:** o usuário declarou aceitação integral da declaração apresentada, sem exceções ou alterações informadas nesta resposta. O aceite cobre as **regras de produto e protocolo de implementação** da REV9, dentro da competência do responsável que se manifestou. Não constitui parecer independente de pediatria/neonatologia nem certificação de exatidão matemática ou legalidade de uso de datasets.

## 3. Decisões expressamente abrangidas

| Item | Política ratificada por manifestação do usuário — ver detalhes normativos integrais na REV9 |
|---|---|
| CL-01 | Roteamento local OMS 2006 até 1856 dias efetivos; OMS 2007 a partir de 1857; tratamento de 29/02, separação de idades, domínio por indicador e adaptação SISVAN aos 19 anos |
| CL-02 | Técnica explícita; referência OMS por idade efetiva; ajuste ±0,7 cm único, original preservado; reconferência em pé antes de 9 meses |
| CL-03 | Z bruto para classificação; exibição a 2 casas; percentis de cauda sem falso 0/100; métodos próprios por referência |
| CL-04 | Cortes/igualdades e terminologia MS/SISVAN 2011 conforme REV9; sem rótulos SISVAN na etapa INTERGROWTH |
| CL-05 | Elegibilidade neonatal explícita; nascimento e dias 0–2 fora do classificador pós-natal; medidas preservadas |
| CL-06 | Modelo contínuo candidato INTERGROWTH, somente peso/comprimento por PMA de 27s0d a 64s0d, condicionado ao G01 |
| CL-07 | OMS corrigida após 64s0d quando aplicável; 36 meses corrigidos para IG <32 semanas, 24 meses corrigidos para IG 32s0d–36s6d; bases separadas |
| CL-08 | **Fórmulas e interpretações adultas desde 18 anos completos**, atendidos domínios próprios, sem afastar a referência SISVAN aos 18–19 e os bloqueios gestacionais |
| CL-09 | Edema/situação desconhecida e flags por indicador, preservação de dados, visibilidade técnica com alerta e suspensão seletiva da classificação |
| CL-10 | Escrita clínica pediátrica por Professional autorizado, leitura de Collaborator autorizada e de SuperAdmin excepcional/auditada, sem novo portal, mantendo RLS/cifra/replay |

## 4. Alcance da ratificação e estado correto dos gates

- **G02 — decisão de protocolo:** `RATIFICADA_PELO_USUARIO_EM_CONVERSA` para a versão identificada, sem ressalvas declaradas.
- **G02 — formalização institucional:** `PENDENTE` até que a equipe confirme identidade/competência conforme seu processo, conserve a evidência em canal protegido, valide que o arquivo inserido no repositório tem o hash acima e registre assinatura/aceite segundo sua governança.
- **G02 — segunda revisão especializada:** `NÃO REALIZADA / NÃO ALEGADA`. Revisão pediátrica/neonatal de CL-02, CL-05 e CL-07 continua recomendada; será obrigatória apenas se exigida pelas regras de governança efetivamente adotadas.
- **G01 — precisão científica/computacional:** `NÃO ALTERADO; NÃO COMPROVADO COMO PASS`. Exige verificação independente de referências, cálculos, curvas, caudas e fixtures.
- **G00 — direitos de incorporação:** `NÃO ALTERADO; PENDENTE` para os materiais afetados.
- **G03-D — desenvolvimento:** conforme autorização anterior do proprietário; não confundir com ativação clínica.
- **G03-A / G04 / G05 — ativação/testes finais/produção:** não aprovados por este aceite.

Nenhuma parte deste registro concede ao modelo, ao Codex ou ao próprio arquivo poderes de assinatura clínica, autorização de dados de terceiros, merge ou deploy.

## 5. Instruções objetivas ao Codex

1. Verificar o SHA-256 do `docs/product/FASE_314_G02_PROTOCOLO_DECIDIDO_REV9.md` realmente presente no repositório. Se não coincidir, **não transportar o aceite** para o conteúdo alterado; solicitar nova aprovação da versão diferente.
2. Guardar apenas este registro não identificável no Git. Manter nome, inscrição profissional, assinatura e evidência de identidade, se exigidos, em registro institucional protegido; incluir só referência opaca no repositório.
3. Atualizar ficha/plano/checklist para refletir `G02-PROTOCOLO: ratificado por manifestação expressa do usuário`, `G02-FORMALIZACAO: pendente`, `G01: pendente` e direitos/gates de ativação independentes.
4. Executar implementação técnica já autorizada e testes. Classificadores ainda sem G01 e direitos resolvidos devem permanecer inativos para uso assistencial real.
5. A aprovação **não substitui** os 20 cenários A01–A20: eles continuam casos de aceite esperados, não testes executados.

## 6. Rastreabilidade desta cópia

Este documento é um **registro derivado da manifestação de aceite na conversa**, criado para transferência ao repositório. Não é transcrição autenticada nem prova criptográfica da conversa. Recomenda-se arquivar o registro original do aceite em sistema institucional sob controle de acesso, com a referência opaca correspondente.
