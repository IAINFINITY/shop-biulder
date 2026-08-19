# PLANO: Conformidade LGPD

## Estado da execução — 19/08/2026

| Etapa | Estado |
|---|---|
| 0.1 / 0.2 · `documentation/` versionada | **feito** — a pasta saiu do `.gitignore` inteira: 152K, só markdown, sem binário nem credencial |
| 0.4 · CLAUDE.md corrigido | **feito** — os três documentos de autenticação sumidos estão registrados como perdidos, e o RP ID saiu das pendências |
| 2.1 · Texto da exclusão de conta | **feito** — a conversa de suporte passou para a lista de apagados, com dois testes travando a promessa |
| 2.2 · Autoria das avaliações | **feito** — migration `20260819120000`, aplicada e validada contra produção com duas contas reais |
| 2.3 · Nome em log claro | **feito** — `mascararNome` em `pii.ts`, com 6 testes, aplicada nas duas rotas |
| `user_name` nas avaliações | **feito** — migration `20260819140000`: o banco devolve `Felipe S.`, não o nome completo |
| 4.1 a 4.6 · Retenção (D5, D6) | **feito** — prazos definidos e expurgo diário no `pg_cron`. Ver [RETENCAO.md](../LGPD/RETENCAO.md) |
| 3.4 · Opt-out de campanhas (D8) | **feito** — legítimo interesse com recusa: coluna, RPC, policy e o controle na conta |
| 5.1 a 5.5 · Runbook de incidente (D9) | **parcial** — o procedimento está escrito em [INCIDENTE.md](../LGPD/INCIDENTE.md); falta o nome do responsável |
| 6.1 · Registro do art. 37 | **feito** — [REGISTRO-DE-TRATAMENTO.md](../LGPD/REGISTRO-DE-TRATAMENTO.md), nove operações |
| 3.1 e 3.2 · Ver e baixar os próprios dados | **feito** — seção Meus dados, com exportação em JSON |
| 1.1 · Texto do aviso de privacidade | **rascunho pronto** — falta o encarregado e a revisão jurídica |
| 6.6 · Trilha de acesso administrativo | **feito, com limite declarado** — cobre a interface, não é prova contra adulteração |
| 3.5 · Instrução ao atendimento | **feito** — [GUIA-DO-ATENDIMENTO.md](../LGPD/GUIA-DO-ATENDIMENTO.md) |
| Minimização no chat de suporte | **feito** — aviso no compositor, onde o dado sensível entraria |

**O achado 2.2 era maior do que a auditoria dizia.** A RPC `get_product_reviews`
é `security definer`, então passa por cima de privilégio de coluna, e ainda
devolve o nome real do cadastro. Ver a correção registrada na auditoria.

**A primeira tentativa de validação reprovou a migration** — e estava certa em
reprovar por um motivo errado: o teste pedia a linha de volta no insert
(`return=representation`), coisa que o app não faz. Refeito com o próprio
`supabase-js`, as quatro operações passam. Fica o registro de que revogar SELECT
de coluna **quebra** quem pede representação no insert.

### O que continua travado, e por quê

| Item | Depende de |
|---|---|
| Frente 1 inteira (aviso de privacidade) | **D1 — quem é o encarregado.** Já existe o canal `lgpd@clinicmais.com.br` na política do site antigo: a pergunta virou *quem responde essa caixa* |
| Retenção da conversa de suporte | **D7** — hoje a tela diz a verdade (é apagada). Mudar isso é mexer no FK |
| Frentes 4, 5 e 6 | D5, D6, D8, D9 e revisão jurídica |

---

## Visão Geral

O diagnóstico está em [documentation/LGPD/AUDITORIA-LGPD.md](../LGPD/AUDITORIA-LGPD.md),
com o texto da lei ao lado em [lei-13709-2018-lgpd.md](../LGPD/lei-13709-2018-lgpd.md).
**Este arquivo não repete a auditoria** — ele transforma os achados em trabalho, na
ordem em que dá para executar.

Seis frentes. A ordem entre elas não é arbitrária:

| Frente | Do que trata | Trava alguma coisa? |
|---|---|---|
| 0. Preservar a documentação | `documentation/` sai do `.gitignore` | **Trava todas** — sem isto o resto se perde na próxima máquina |
| 1. Transparência | Aviso de privacidade, encarregado, rota `/privacidade` | Depende de decisão: quem é o encarregado |
| 2. Correções de código | Três achados concretos, todos pequenos | Não trava nada. Pode ir junto com a 1 |
| 3. Direitos do titular | Ver, exportar, canal declarado | Depende da 1 (o aviso é onde o canal se anuncia) |
| 4. Retenção e eliminação | Prazos e limpeza automática | Depende de decisão: quantos anos de cada coisa |
| 5. Incidente | Runbook dos 3 dias úteis | Não trava. Mas é o que dói se acontecer antes de existir |
| 6. Governança documental | Registro do art. 37, contratos de operador | Depende de 1 a 5 estarem decididos |

A **frente 2** é a única inteiramente resolvível sem decisão de negócio. Se a
prioridade for mostrar avanço rápido, é por ali.

---

## O que trava: decisões que só você toma

Estas nove respostas destravam quase todo o plano. Sem elas, várias etapas abaixo
ficam com um espaço em branco no meio.

| # | Pergunta | Trava |
|---|---|---|
| D1 | Quem é o encarregado (nome e contato público)? | Frente 1 inteira |
| D2 | `documentation/` sai do `.gitignore`? | Frente 0 |
| D3 | Em que região está o projeto Supabase? E as funções na Vercel? | Frente 6 (transferência internacional) |
| D4 | Onde roda o Bitrix24, e existe contrato de tratamento? | Frente 6 |
| D5 | Quantos anos guardar pedido? (guarda fiscal) | Frente 4 |
| D6 | Quanto tempo guardar conversa de suporte, trilha de auditoria e favoritos? | Frente 4 |
| D7 | A equipe precisa da conversa de suporte depois que a conta é excluída? | Etapa 2.1 |
| D8 | Qual a base legal das notificações de campanha — consentimento ou legítimo interesse? | Etapa 3.4 |
| D9 | Quem responde por um incidente, fora do horário comercial? | Frente 5 |

**D1 e D2 são as urgentes.** As outras podem ser respondidas durante a execução.

---

## Frente 0 — Preservar a documentação

Pré-requisito de tudo. O art. 37 e a responsabilização (art. 6º, X) se demonstram
com documento; documento em pasta ignorada pelo Git não sobrevive a uma troca de
máquina — e já não sobreviveu uma vez: `AUTH.MD`, `PERFIL-CLINIC-PLUS.md` e
`EXCECOES-REGISTRADAS.md`, que o [CLAUDE.md](../../CLAUDE.md) declara como fonte da
verdade, não existem mais em disco nenhum.

| # | Tarefa | Tipo |
|---|--------|------|
| 0.1 | Decidir D2: versionar `documentation/` inteira, ou abrir exceção só para `documentation/LGPD/` e `documentation/planejamento/` | Decisão |
| 0.2 | Ajustar `.gitignore` conforme 0.1 | Config |
| 0.3 | Commit inicial da pasta LGPD (lei, índice, auditoria) e deste plano | Git |
| 0.4 | Atualizar o CLAUDE.md: os três arquivos de autenticação não existem mais. Ou se reescrevem, ou a seção que os cita sai | Doc |

> **Atenção ao 0.1.** A pasta `documentation/catalogo/` tem planilhas de catálogo e
> `documentation/contexto/` pode ter material que não deva ir para o repositório.
> Versionar tudo de uma vez sem olhar é o tipo de decisão que se lamenta depois.
> Se houver dúvida, a exceção estreita resolve o problema da LGPD sem abrir o resto.

---

## Frente 1 — Transparência (art. 9º e art. 41)

Hoje o site coleta nome, telefone, CNPJ e e-mail sem dizer uma palavra sobre o que
faz com eles. É a falha mais visível de fora e a mais barata de corrigir.

### O que o aviso precisa dizer

O art. 9º pede acesso facilitado a: finalidade específica, forma e duração do
tratamento, identificação do controlador com contato, uso compartilhado e com quem,
responsabilidades dos agentes, e os direitos do art. 18. O art. 41, § 1º acrescenta
a identidade e o contato do encarregado.

Traduzido para o que este projeto de fato faz:

- **Quem é o controlador** — razão social, CNPJ e endereço da Clinic+
- **Quem é o encarregado** — D1
- **O que se coleta** — cadastro (nome, telefone, e-mail, CNPJ, endereço), pedido,
  conversa de suporte, favoritos, avaliações, dados de segurança (aparelhos
  lembrados, trilha de acesso)
- **Para quê e com qual base legal** — cadastro e pedido por execução de contrato
  (art. 7º, V); segurança e prevenção a fraude por legítimo interesse (art. 7º, IX);
  campanhas conforme D8
- **Com quem se compartilha** — Proxsys (ERP, para faturar o pedido), Bitrix24 (CRM),
  Supabase (hospedagem do banco), Vercel (hospedagem do site). E, a partir do
  navegador, ViaCEP e cnpj.ws na hora de preencher endereço e cadastro
- **Por quanto tempo** — D5 e D6
- **Direitos e como exercer** — os do art. 18, com o canal da etapa 3.3
- **Que não há rastreador** — sem Analytics, sem pixel, sem cookie de terceiro. Vale
  dizer: é verdade, é incomum, e evita a pergunta

| # | Tarefa | Tipo |
|---|--------|------|
| 1.1 | Redigir o texto do aviso, em linguagem clara. Revisão jurídica antes de publicar | Doc |
| 1.2 | `src/pages/Privacidade.tsx` — página estática, sem dependência de sessão (tem que abrir deslogado) | TSX |
| 1.3 | Rota `/privacidade` em `src/App.tsx`, **fora** do bloco autenticado | TSX |
| 1.4 | Link no rodapé (`StoreFooter.tsx`), no grupo institucional | TSX |
| 1.5 | Linha no passo 2 do cadastro em `Login.tsx`: "Ao criar a conta você concorda com o tratamento descrito no aviso de privacidade", com link | TSX |
| 1.6 | Bloco do encarregado na página de ajuda (`Help.tsx`), junto do atendimento | TSX |
| 1.7 | Versionar o aviso com data de vigência — muda com o tempo, e é preciso saber qual versão valia quando | Doc |

> **Não usar checkbox de aceite aqui.** A base legal do cadastro é execução de
> contrato, não consentimento. Pedir "aceito" para algo que não depende de aceite
> cria a impressão de que o titular pode revogar e travar o próprio pedido — e o
> art. 8º, § 5º dá a ele o direito de revogar o que foi consentido. Informar é o
> correto; consentir é para o que precisa de consentimento (D8).

---

## Frente 2 — Correções de código

Três achados fechados, sem decisão pendente exceto D7.

### 2.1 A tela de exclusão diz o que o banco não faz

`exclusaoDeConta.ts` promete que a conversa de suporte fica vinculada ao CNPJ. O FK
tem `ON DELETE CASCADE` — a conversa inteira some com a conta. Duas saídas, e a
escolha é D7:

- **Se a equipe não precisa do histórico:** corrigir o texto. Move `Conversas de
  suporte` de `DADOS_RETIDOS` para `DADOS_EXCLUIDOS`, com detalhe honesto. Uma
  migration, zero. É a saída barata e provavelmente a certa.
- **Se precisa:** migration trocando o FK para `ON DELETE SET NULL`, anulando
  `customer_name` e `customer_phone` no mesmo movimento, e ajuste no
  `excluir-conta.ts` para fazer a anonimização antes de remover o usuário. Aí o
  texto atual passa a ser verdade.

| # | Tarefa | Tipo |
|---|--------|------|
| 2.1a | Decidir D7 | Decisão |
| 2.1b | Aplicar a saída escolhida | TS ou SQL |
| 2.1c | Teste que trava o comportamento: conta excluída → conversa some (ou é anonimizada) | Teste |

### 2.2 `user_id` das avaliações legível por cliente logado

A migration `20260807200000` fechou para `anon` e esqueceu `authenticated`. O grant
de tabela na linha 655 de `20260804120000_clinic_b2b_rls_policies.sql` continua de pé,
com policy `USING (true)`.

| # | Tarefa | Tipo |
|---|--------|------|
| 2.2a | Migration `2026MMDDHHMMSS_avaliacoes_sem_user_id_authenticated.sql`: `revoke select on table ... from authenticated` e reconceder coluna a coluna, menos `user_id` | SQL |
| 2.2b | Conferir que o cliente ainda edita e apaga a própria avaliação — as policies de `INSERT`/`UPDATE`/`DELETE` comparam `auth.uid() = user_id` e **não** dependem de SELECT na coluna | SQL |
| 2.2c | Conferir `get_product_reviews` e a tela de "minhas avaliações", se houver | TS |

> A armadilha que a migration original documenta — grant de tabela vence revoke de
> coluna — vale igual aqui. Repetir o padrão dela, não inventar outro.

### 2.3 Nome do cliente em log claro

| # | Tarefa | Tipo |
|---|--------|------|
| 2.3a | `proxis-order.ts:902` e `bitrix-deal.ts:145`: aplicar máscara ao nome, ou trocar por `user_id` | TS |
| 2.3b | Varrer `api/` atrás de outros `console.log` com nome, e-mail ou telefone | TS |

---

## Frente 3 — Direitos do titular (arts. 18 e 19)

A exclusão, que é o direito mais difícil, está pronta. O acesso, que é o mais fácil,
não existe. Esta frente fecha a lacuna.

| # | Tarefa | Tipo |
|---|--------|------|
| 3.1 | Seção "Meus dados" na conta: uma tela só, com tudo o que se guarda sobre a pessoa — cadastro, endereços, pedidos, avaliações, favoritos, aparelhos. Atende art. 18, II e art. 19, II | TSX |
| 3.2 | Botão de exportar em JSON. Reaproveita as consultas da 3.1; o formato legível por máquina é o que o art. 18, V pede | TS |
| 3.3 | Canal declarado para pedidos de titular: um e-mail que chega a alguém, anunciado no aviso de privacidade, com o relógio de **15 dias** (art. 19, II) visível para quem atende | Processo |
| 3.4 | Opt-out das campanhas conforme D8. Se for consentimento, revogação gratuita e facilitada (art. 8º, § 5º). Se for legítimo interesse, o art. 10 exige só o estritamente necessário (§ 1º) e transparência reforçada (§ 2º), e a ANPD pode pedir relatório de impacto (§ 3º) — na prática, oferecer a recusa é o que sustenta a base. Nos dois casos: uma chave por usuário e uma tela | SQL + TSX |
| 3.5 | Instrução ao atendimento: reconhecer "quero meus dados", "apaga meus dados", "não quero receber" como pedidos com prazo legal, e para onde encaminhar | Processo |

> A 3.1 é mais barata do que parece: os dados já estão todos na tela, espalhados em
> Empresa, Endereços, Pedidos e Aparelhos. É agregação, não coleta nova.

---

## Frente 4 — Retenção e eliminação (arts. 15 e 16)

Hoje nada é apagado por decurso de prazo. Depende de D5 e D6.

| # | Tarefa | Tipo |
|---|--------|------|
| 4.1 | Definir a tabela de prazos: por tabela, quanto tempo e com que justificativa | Decisão |
| 4.2 | Agendar `clinic_b2b_limpar_dispositivos_confiaveis()` — a função existe desde `20260808220000` e **nada a chama**. `pg_cron` no Supabase, ou uma rota chamada por cron da Vercel | SQL |
| 4.3 | Expurgo de `clinic+b2b_rate_limit`: linha de janela vencida não serve para nada | SQL |
| 4.4 | Prazo para `clinic+b2b_auth_events`. Trilha de segurança justifica guarda longa, mas "para sempre" não é prazo | SQL |
| 4.5 | Prazo para conversa de suporte encerrada | SQL |
| 4.6 | Registrar cada prazo no aviso de privacidade (art. 9º) e no registro do art. 37 | Doc |

---

## Frente 5 — Incidente de segurança (art. 48)

**3 dias úteis** da confirmação, pela Resolução CD/ANPD nº 15/2024, peticionado pelo
SEI!. Só o controlador comunica, e comunicar à ANPD não basta — o art. 48 também
exige avisar os titulares afetados.

| # | Tarefa | Tipo |
|---|--------|------|
| 5.1 | Runbook: quem detecta, quem confirma, quem decide comunicar, quem redige, quem peticiona. Com nome, não com cargo | Doc |
| 5.2 | Login no SEI! criado e testado **antes** de precisar. Descobrir que não se tem acesso no dia 1 dos 3 é o pior cenário | Processo |
| 5.3 | Modelo de comunicação ao titular, pronto para preencher | Doc |
| 5.4 | Fechar o buraco da trilha: falha de login não gera linha, porque o Supabase não cria sessão com senha errada. Webhook do Auth ou registro na borda | TS |
| 5.5 | Definir o que conta como incidente aqui: vazamento de export local, acesso indevido de admin, comprometimento de chave, exposição por RLS | Doc |

> A 5.4 tem valor além do incidente: sem ela, ataque de força bruta é exatamente o
> que não aparece na trilha.

---

## Frente 6 — Governança documental (arts. 33 a 39)

O que não vive no código.

| # | Tarefa | Tipo |
|---|--------|------|
| 6.1 | Registro das operações de tratamento (art. 37): por operação, finalidade, base legal, categorias de dado, retenção, compartilhamento. É o documento que organiza todos os outros | Doc |
| 6.2 | Confirmar D3 e D4 — regiões de Supabase, Vercel e Bitrix | Investigação |
| 6.3 | Se houver transferência internacional: escolher a base do art. 33 e formalizar (cláusulas-padrão do art. 35, ou cláusulas específicas) | Jurídico |
| 6.4 | Contrato de operador (art. 39) com Proxsys, Supabase, Vercel, Bitrix e OpenAI | Jurídico |
| 6.5 | Registrar a decisão sobre legítimo interesse das campanhas, se for esse o caminho — o art. 37 exige registro justamente para essa base | Doc |
| 6.6 | Trilha de acesso administrativo a dado pessoal: hoje admin lê todo perfil de cliente e **nada registra**. Se for preciso responder "quem viu o cadastro deste cliente", não há resposta | SQL |

---

## Sequência

**Onda 1 — destrava e mostra resultado** (depende de D1 e D2)

0.1 → 0.2 → 0.3 · 1.1 a 1.7 · 2.2 · 2.3

A frente 2.2 e 2.3 entram aqui porque não dependem de ninguém e saem no mesmo deploy.

**Onda 2 — o titular passa a conseguir agir** (depende de D7 e D8)

2.1 · 3.1 → 3.2 → 3.3 · 3.5

**Onda 3 — o que envelhece some** (depende de D5 e D6)

4.1 → 4.2 a 4.6 · 3.4

**Onda 4 — governança e o que é jurídico**

5.1 a 5.5 · 6.1 a 6.6

A onda 5 pode subir de prioridade a qualquer momento: ela é a única cujo custo de
não existir aparece de uma vez só, e não aos poucos.

---

## Critério de pronto

Marcos verificáveis, não sensação de avanço:

- [ ] `documentation/` versionada, e um `git log` prova
- [ ] `/privacidade` abre deslogado, com controlador e encarregado nomeados
- [ ] Link para o aviso no rodapé e no cadastro
- [ ] Texto da exclusão de conta bate com o que o banco faz — com teste que trava
- [ ] `has_column_privilege('authenticated', 'clinic+b2b_product_reviews', 'user_id', 'select')` retorna **false**
- [ ] Nenhum `console.log` em `api/` com nome, e-mail ou telefone em claro
- [ ] Titular consegue ver e exportar os próprios dados sem falar com ninguém
- [ ] Canal de pedidos de titular anunciado, com dono e prazo de 15 dias
- [ ] Cada tabela com dado pessoal tem prazo escrito e rotina que o cumpre
- [ ] Runbook de incidente com nome de pessoa e acesso ao SEI! testado
- [ ] Registro do art. 37 existe e cobre toda operação do mapa da auditoria

---

## O que este plano não cobre

- **Revisão jurídica.** O texto do aviso, os contratos de operador e a base de
  transferência internacional precisam de advogado. Aqui está o que o sistema faz,
  não o que o contrato deve dizer.
- **Sondagem de produção.** A auditoria foi estática. Região do Supabase, retenção
  de backup, quem tem acesso ao painel e se `auth.audit_log_entries` voltou a
  gravar — nada disso foi verificado contra o ambiente no ar.
- **Relatório de impacto (art. 38).** A ANPD pode exigir um. Não há sinal de que
  seja o caso hoje, mas se o tratamento de dado de MEI crescer, ou se aparecer
  decisão automatizada (art. 20), a conversa muda.
