# Registro das operações de tratamento (art. 37)

**Controlador:** Clinic+ / AMAIS Indústria de Alimentos Ltda — CNPJ 04.163.851/0001-06
Rua Lauro Muller, 60, Matinho — Xanxerê/SC
**Sistema:** Catálogo B2B (`catalogo-clinicmais.iainfinity.com.br`)
**Encarregado:** *(a definir — ver observação no fim)*
**Elaborado em:** 19/08/2026 · **Base:** leitura do código, migrations e RLS

O art. 37 obriga controlador e operador a manter registro das operações de
tratamento, especialmente quando fundadas em legítimo interesse. Este é esse
registro para o catálogo B2B — não cobre o e-commerce B2C, que é outro sistema.

Cada linha responde às cinco perguntas que a ANPD faz: **o quê**, **para quê**,
**com que base**, **por quanto tempo**, **com quem**.

---

## 1. Cadastro do cliente

**Dados:** nome, e-mail, telefone, CNPJ, endereço completo, tipo de cliente,
observação (texto livre), enquadramento MEI
**Onde:** `clinic+b2b_customer_profiles`, `clinic+b2b_customer_addresses`
**Finalidade:** identificar quem compra, permitir o acesso à conta e endereçar a
entrega
**Base legal:** execução de contrato (art. 7º, V) — sem cadastro não há pedido
**Retenção:** enquanto a conta existir; some com ela
**Compartilhado com:** Proxsys (cria o cliente no ERP), Bitrix (registra o
negócio), Supabase (hospeda)

> No MEI e no Empresário Individual a razão social **é** o nome da pessoa. Para
> essa fatia da base, "dado da empresa" e "dado pessoal" coincidem, e o
> tratamento é o mesmo de pessoa natural.

## 2. Pedido

**Dados:** nome, telefone, CNPJ, endereço de entrega, itens, observação
**Onde:** `clinic+b2b_orders`
**Finalidade:** processar e faturar a compra
**Base legal:** execução de contrato (art. 7º, V); a guarda posterior é
cumprimento de obrigação legal (art. 7º, II)
**Retenção:** **5 anos** — prazo em que o fisco pode cobrar tributo da nota
(CTN, arts. 173 e 174). Expurgo diário automático
**Compartilhado com:** Proxsys (é onde o pedido vira documento fiscal), Bitrix

## 3. Atendimento por chat

**Dados:** nome, telefone, CNPJ e **o texto livre das mensagens**
**Onde:** `clinic+b2b_support_conversations`, `clinic+b2b_support_messages`
**Finalidade:** atender dúvida e reclamação
**Base legal:** execução de contrato (art. 7º, V)
**Retenção:** **2 anos** após a última mensagem — cobre o prazo de reclamação do
consumidor (CDC, art. 27). Apagada junto com a conta, por cascata
**Compartilhado com:** ninguém fora do Supabase

> **Risco conhecido:** o corpo da mensagem é livre. Num negócio de saúde, é onde
> dado sensível (art. 11) aparece sem ninguém ter planejado. Não há filtro, e a
> equipe de atendimento precisa saber disso.

## 4. Avaliação de produto

**Dados:** autoria (`user_id`), nota, título, comentário, etiquetas
**Onde:** `clinic+b2b_product_reviews`
**Finalidade:** mostrar experiência de outros compradores
**Base legal:** legítimo interesse (art. 7º, IX) — a avaliação é publicada por
ato voluntário de quem escreve
**Retenção:** enquanto a conta existir
**Compartilhado com:** ninguém; é exibido dentro do site

> Desde 19/08/2026 a autoria só volta para o próprio autor, e o nome sai
> abreviado (`Felipe S.`), nunca completo. Migrations `20260819120000` e
> `20260819140000`.

## 5. Lista de favoritos

**Dados:** produtos salvos, vinculados à conta
**Onde:** `clinic+b2b_customer_favorites`
**Finalidade:** o cliente reencontrar o que separou
**Base legal:** execução de contrato (art. 7º, V)
**Retenção:** enquanto a conta existir
**Compartilhado com:** ninguém

## 6. Notificações de campanha

**Dados:** vínculo entre a campanha e quem já leu
**Onde:** `clinic+b2b_catalog_notifications`, `clinic+b2b_catalog_notification_reads`
**Finalidade:** comunicar novidade e promoção dentro do catálogo
**Base legal:** **legítimo interesse (art. 7º, IX)**, com direito de recusa
**Retenção:** enquanto a conta existir
**Compartilhado com:** ninguém

> É a operação que mais exige justificativa, e por isso está registrada com mais
> detalhe. O art. 10, § 1º limita ao estritamente necessário e o § 2º exige
> transparência reforçada. Na prática: existe um controle em Notificações, na
> conta, que desliga. Aviso endereçado à pessoa continua chegando — recusar
> propaganda não é recusar aviso sobre o próprio pedido.

## 7. Segurança da conta

**Dados:** eventos de autenticação (quem, o quê, quando), aparelhos lembrados
(hash de token e rótulo grosseiro), contador de tentativas por conta
**Onde:** `clinic+b2b_auth_events`, `clinic+b2b_dispositivos_confiaveis`,
`clinic+b2b_rate_limit`
**Finalidade:** investigar incidente, impedir força bruta, lembrar aparelho
confiável
**Base legal:** legítimo interesse (art. 7º, IX) — proteger a conta do próprio
titular
**Retenção:** trilha **1 ano**; aparelho **90 dias** após expirar; contador
**1 dia**. Expurgo diário automático
**Compartilhado com:** ninguém

> Minimizado de propósito: o contador é por conta, **não por IP** — um dado
> pessoal a menos guardado. A trilha nunca recebe token, senha, hash ou código.

## 8. Consulta de CNPJ e CEP

**Dados:** o CNPJ e o CEP digitados
**Onde:** não são armazenados; a consulta sai do navegador do cliente
**Finalidade:** preencher razão social e endereço sem redigitação
**Base legal:** execução de contrato (art. 7º, V)
**Retenção:** não se aplica
**Compartilhado com:** BrasilAPI, cnpj.ws, ViaCEP — todos com dado público da
Receita e dos Correios

## 9. Resumo de produto por IA

**Dados:** **nenhum dado pessoal.** Só nome e descrição do produto
**Base legal:** não se aplica — não há dado pessoal na operação
**Compartilhado com:** OpenAI

> Registrado justamente para deixar claro que nada de cliente segue por aqui, e
> que assim deve permanecer.

---

## Transferência internacional

O banco está em **São Paulo** (`sa-east-1`): o maior volume de dado pessoal não
atravessa fronteira.

Sai do país: a **execução das funções da Vercel**, medida em `iad1` (Estados
Unidos), por onde passam nome, CNPJ, telefone e e-mail em trânsito; e o
**Bitrix24**, cuja região ainda não foi confirmada. Detalhe e encaminhamento em
[OPERADORES.md](OPERADORES.md).

## Direitos do titular, e por onde se exercem hoje

| Direito | Artigo | Estado |
|---|---|---|
| Confirmação e acesso | 18, I e II | **em falta** — não há tela que reúna tudo |
| Correção | 18, III | atendido: a pessoa edita nome, telefone e endereço |
| Portabilidade | 18, V | **em falta** — não há exportação |
| Eliminação | 18, VI | atendido, com reautenticação por senha |
| Oposição a campanha | 7º, IX c/c art. 10 | atendido desde 19/08/2026 |
| Informação sobre compartilhamento | 18, VII | **em falta** — depende do aviso de privacidade |

## O que falta neste registro

1. **Nome e contato do encarregado** (art. 41). Existe o canal
   `lgpd@clinicmais.com.br`, herdado do site principal, mas a identidade não está
   publicada. É a única lacuna que impede este documento de ficar completo.
2. **Contratos de operador** (art. 39) — levantamento em [OPERADORES.md](OPERADORES.md).
3. **Retenção dos backups do Supabase**, que é própria do plano contratado e
   independe do expurgo das tabelas.
