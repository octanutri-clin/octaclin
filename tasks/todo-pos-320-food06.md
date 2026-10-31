# FOOD06 — checklist

Estado vigente: ficha/quadro ratificados em 2026-10-31; núcleo T03-A isolado
implementado, sem comparação assistencial ou referência clínica habilitada.
Fonte de contrato: [plano](plan-pos-320-food06.md), base `68499c15`.

- [x] Criar branch/worktree isoladas e preservar delta preexistente.
- [x] Inventariar motor PA06, escala decimal, serviço, DTO, BFF e interface.
- [x] Registrar decisões humanas F06-D01, F06-D02 e F06-D03.
- [x] Consultar apenas os repositórios pertinentes já mapeados no planejamento;
      nenhuma nova dependência necessária nesta inspeção.
- [x] Obter páginas oficiais candidatas e hashes preliminares de Health Canada.
- [x] Identificar licença OGL no registro oficial e exceção para terceiros.
- [x] Preparar matriz semântica de todos os 22 códigos e regras F06-CL01–08.
- [x] Criar coletor documental sem dependências e executar oito testes sintéticos.
- [x] Registrar nova obtenção e hashes de bytes/texto; conservar histórico anterior.
- [x] Extrair quadro adulto candidato com unidades RDA/AI versus UL separadas.
- [x] Registrar confronto com outras publicações oficiais e limites 403/CAPTCHA.
- [x] Conferir cadeia registro OGL → índice → páginas atuais; documentar ressalvas.
- [x] Executar RED/GREEN do extrator; 19 testes sintéticos locais aprovados.
- [x] Adicionar workflow específico para executar os testes documentais no CI.
- [x] CI de `cb8a9c47`: 22 checks success, incluindo suíte específica; SBOM provenance SKIPPED.
- [x] Ratificação humana CL01–CL08 e quadro adulto DRI de `cb8a9c47` registrada.
- [x] T01: confirmar contexto diário e regras de elegibilidade; implementação da resolução ainda pertence a T03-B/T04.
- [ ] T02: mapear cada código a RDA/AI e UL com unidades, origem, notas e versão.
- [x] T02: ficha clínica e valores ratificados pelo proprietário/equipe clínica.
- [ ] T02: fechar direitos do artefato específico e revisão institucional aplicável.
- [x] T03-A: implementar núcleo puro com TDD, referências sintéticas e oráculo Python Decimal, sem registro/rotas.
- [ ] T03-A: verificar CI do novo HEAD com ferramentas/dependências exatas.
- [ ] T03-B: referências clínicas versionadas, direitos e resolução de contexto/faixas.
- [ ] T04: integração de backend/BFF com permissões, revisões e projeções.
- [ ] T05: interface acessível e avaliações UX etapa B.
- [ ] T06: banco descartável/RLS, regressões e revisão R4 independente.
- [ ] T07: UX C, CI/scanners e PR Draft com evidências rastreáveis.

Cobertura futura obrigatória: 18/19 anos, fronteiras por faixa de tabela, sexo da
referência não confirmado, gestação/lactação, data inválida, totais completos e
parciais, zero conhecido, unidade e forma incompatíveis, UL ausente/restrito,
seleção vazia, planos/refeições OFF, publicações/revisões stale, transferência de
carteira, tenant adversário, acesso revogado, cancelamento e resposta tardia.

Fora do escopo: EAR/CDRR como substituto de UL, diagnóstico, consumo real presumido,
suplementação automática, ajuste de prescrição, portal, TBCA e operação externa.
Nenhum teste de implementação executado nesta etapa documental. G06 permanece
fora desta entrega. Uma PR documental não comprova ativação ou disponibilidade.
