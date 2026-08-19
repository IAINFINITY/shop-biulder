# Auditoria LGPD — Clinic+ B2B

**Data:** 19 de agosto de 2026 · **Base:** `07c2560`, working tree limpo
**Método:** leitura estática do repositório — migrations, rotas `api/`, `src/`, RLS,
CSP e integrações. **Nada foi sondado contra o Supabase, a Proxsys ou o Bitrix em
execução.** Onde a resposta depende de configuração fora do repositório, está
marcado como pergunta em aberto, não como conclusão.

Referência: [lei-13709-2018-lgpd.md](lei-13709-2018-lgpd.md). Os artigos citados
apontam para lá.

---

## O ponto de partida que muda tudo

Existe uma leitura confortável de que "isto é B2B, então trata dado de empresa, e
dado de empresa não é dado pessoal". **Ela não se sustenta aqui**, por três motivos:

1. `clinic+b2b_customer_profiles` guarda `name`, `phone`, `email` — dado de pessoa
   natural, art. 5º, I. Nome e telefone de quem compra, não da razão social.
2. O trabalho recente de MEI (`is_mei`, commits `1e6b525`…`07c2560`) reconheceu no
   código o que a lei já dizia: **no MEI e no Empresário Individual, a razão social
   É o nome da pessoa**. O CNPJ identifica uma pessoa natural. Para essa fatia da
   base, "dado cadastral da empresa" e "dado pessoal" são a mesma linha.
3. `clinic+b2b_support_messages.body` é texto livre. O que o cliente escreve ali
   não passa por filtro — e conversa de suporte de um negócio de saúde é
   exatamente onde dado sensível (art. 11) aparece sem ninguém ter planejado.

Então a LGPD se aplica ao projeto inteiro. A pergunta não é "se", é "o quanto".

---

## Mapa do que se trata

| Onde | Dado pessoal | Observação |
|---|---|---|
| `customer_profiles` | nome, telefone, e-mail, CNPJ, endereço completo, `observation` (texto livre) | O núcleo |
| `customer_addresses` | endereços de entrega | |
| `orders` | nome, telefone, CNPJ, endereço, itens | Cópia congelada no momento do pedido |
| `support_conversations` / `support_messages` | nome, telefone, CNPJ, **corpo livre** | Risco de dado sensível não planejado |
| `product_reviews` | `user_id`, texto da avaliação, nome abreviado do autor | Desde 19/08/2026: autoria só para o dono, nome como `Felipe S.` |
| `customer_favorites` | comportamento de compra | |
| `dispositivos_confiaveis` | hash de token, rótulo grosseiro do aparelho | Minimizado de propósito |
| `auth_events` | `user_id`, evento, data | Trilha de segurança |
| `rate_limit` | chave `rota:conta:user_id` | Sem IP |
| `user_roles`, `admin_users` | vínculo de pessoa a papel | |

**Sai do nosso domínio para:** Supabase (hospedagem do banco e do Auth), Vercel
(hospedagem e logs), Proxsys/ProManager (ERP — pedido e cadastro), Bitrix24 (CRM —
nome, CNPJ, telefone, e-mail), OpenAI (**só dado de produto**), ViaCEP e
`publica.cnpj.ws` (consulta a partir do navegador), HIBP (prefixo de hash).

---

## O que está certo

Não é pouco, e vale registrar antes das falhas — várias dessas coisas custam caro
para conseguir depois.

**Nenhum rastreador.** Sem Google Analytics, sem pixel de Facebook, sem Hotjar,
sem Clarity. A CSP em [vercel.json](../../vercel.json) tem `script-src 'self'`,
o que impede que apareça um por acidente. Consequência prática: **o site hoje não
precisa de banner de cookie**, e essa é uma das poucas frentes de LGPD que já
nasce resolvida.

**Segurança técnica (art. 46).** HSTS, `frame-ancestors 'none'`, `X-Frame-Options`,
`nosniff`, `Referrer-Policy`, `Permissions-Policy` fechando câmera/microfone/
geolocalização, `Cross-Origin-Opener-Policy`. RLS ligada nas tabelas, bucket de
imagem só admin, isolamento da tabela de preço.

**Senha vazada sem entregar a senha.** [senhaVazada.ts](../../src/lib/senhaVazada.ts)
usa k-anonimato: SHA-1 calculado no navegador, só 5 caracteres saem da máquina, a
comparação acontece localmente. Nem o nosso servidor nem o HIBP veem a senha ou o
hash inteiro. É o padrão que a lei pediria se falasse de senha nesse nível.

**Rate limit por conta, não por IP** ([_rateLimit.ts](../../api/_rateLimit.ts)).
Um IP a menos guardado é um dado pessoal a menos tratado. Minimização (art. 6º, III)
feita sem ninguém pedir.

**A IA não vê dado pessoal.** [resumo-produto.ts](../../api/resumo-produto.ts) manda
para a OpenAI apenas nome e descrição do produto. Nenhum dado de cliente atravessa
a fronteira por esse caminho.

**Trilha de auditoria escrita por gatilho no banco**, nunca pelo navegador, e com
lista explícita do que nunca entra: token, senha, hash, código TOTP, cabeçalho.

**Direito de eliminação existe e é levado a sério** (art. 18, VI).
[api/excluir-conta.ts](../../api/excluir-conta.ts) exige reautenticação por senha,
apaga em ordem que respeita FK, e registra resíduo em log quando alguma tabela
falha. A tela lê a mesma lista que a rota executa
([exclusaoDeConta.ts](../../src/lib/exclusaoDeConta.ts)) — arquitetura correta,
ainda que o **conteúdo** da lista esteja errado num ponto (achado 8).

**Direito de correção existe** (art. 18, III): `update_own_customer_profile`
deixa a pessoa corrigir nome, telefone e endereço sozinha.

**CNPJ mascarado em log** (`mascararCnpj` em `proxis-customer.ts` e `proxis-order.ts`).

**Exports locais fora do Git.** O `.gitignore` bloqueia `local-exports/` com
comentário dizendo por quê. `scripts/export-clinic-tables.mjs` despeja
`customer_profiles` e `orders` em JSON — se isso vazasse para o repositório, seria
o pior incidente possível. Está barrado.

---

## O que falta

Ordenado por consequência. Os quatro primeiros são o que um fiscal da ANPD pede
primeiro, e nenhum existe hoje.

### 1. Não há aviso de privacidade. Em lugar nenhum. (art. 9º)

Varri `src/`, `api/`, `index.html` e as rotas de [App.tsx](../../src/App.tsx). As
rotas são `/`, `/produto/:id`, `/pedido`, `/pedido/obrigado`, `/login`,
`/recuperar-senha`, `/conta`, `/ajuda`, `/favoritos`, `/admin`. **Não existe
`/privacidade` nem `/termos`.** O rodapé
([StoreFooter.tsx](../../src/components/layout/StoreFooter.tsx)) liga para
Instagram, Facebook, YouTube, Pinterest e blog — não liga para política nenhuma. O
formulário de cadastro em [Login.tsx](../../src/pages/Login.tsx) coleta nome,
telefone, CNPJ e e-mail sem uma linha dizendo o que será feito com aquilo.

O art. 9º dá ao titular direito a **acesso facilitado** à finalidade, à forma e à
duração do tratamento, à identificação do controlador e às responsabilidades dos
agentes. Nada disso está disponível. É a falha mais visível de fora e a mais barata
de corrigir.

### 2. Não há encarregado identificado (art. 41)

Zero ocorrências de "encarregado", "DPO" ou "proteção de dados" em `src/` e `api/`.
O art. 41, § 1º exige que a **identidade e as informações de contato** do
encarregado sejam divulgadas publicamente, de forma clara e objetiva — normalmente
no próprio aviso de privacidade. Sem isso, o titular não tem a quem reclamar, e a
primeira coisa que a ANPD pergunta numa fiscalização é quem é o encarregado.

### 3. Não há registro das operações de tratamento (art. 37)

O art. 37 obriga controlador e operador a manterem registro das operações,
especialmente quando baseadas em legítimo interesse. Não existe esse documento.
Este arquivo é o mapa técnico, mas não é o registro: falta declarar, por operação,
a **finalidade**, a **base legal** (art. 7º), o **prazo de retenção** e **com quem
se compartilha**.

Base legal, aliás, é a pergunta não respondida em vários pontos. Cadastro e pedido
se sustentam em execução de contrato (art. 7º, V). Mas as notificações de campanha
(`catalog_notifications`, seção "Campanhas e avisos" da conta) são marketing, e
marketing não cabe em execução de contrato — ou é consentimento (art. 7º, I) ou é
legítimo interesse (art. 7º, IX) com direito de oposição. **Não há opt-out em lugar
nenhum do código.**

### 4. Não há procedimento de incidente, e o prazo é curto (art. 48)

O art. 48 obriga a comunicar incidente à ANPD e ao titular. A Resolução CD/ANPD
nº 15/2024 fixou **3 dias úteis** contados da confirmação, e a comunicação é
peticionada pelo SEI!. Não existe runbook, não existe dono definido, não existe
ensaio. Três dias úteis é pouco tempo para descobrir quem decide, quem redige e
quem tem login no SEI!.

Agrava: a trilha registra sessão criada e MFA, mas **falha de login não gera linha**
— o Supabase não cria sessão com senha errada, então o gatilho não tem o que ver.
Ataque de força bruta é justamente o que não aparece na trilha hoje.

### 5. Nada é apagado por decurso de prazo (arts. 15 e 16)

O art. 16 manda eliminar o dado após o término do tratamento, ressalvadas as
hipóteses de guarda. Na prática:

- `auth_events` cresce para sempre. Sem política, sem limpeza.
- `rate_limit` acumula linhas sem expurgo.
- `support_conversations` não tem prazo.
- `clinic_b2b_limpar_dispositivos_confiaveis()` existe
  ([migration:74](../../supabase/migrations/20260808220000_dispositivos_confiaveis.sql))
  **mas nada a chama** — não há `pg_cron` agendado em migration nenhuma. É função
  escrita, testada e morta.

Guardar para sempre "porque um dia pode ser útil" é exatamente o que o art. 15 não
permite.

### 6. O titular não consegue ver nem levar os próprios dados (art. 18, II e V; art. 19)

A conta tem Empresa, Endereços, Pedidos, Notificações, Mensagens, Configurações,
Aparelhos, Autenticadores e Excluir conta. **Não tem "meus dados" nem exportação.**

- Art. 18, II — confirmação e acesso: parcialmente atendido de forma dispersa (a
  pessoa vê seu cadastro e seus pedidos em telas diferentes), mas não há a
  declaração clara e completa que o art. 19, II exige, com origem dos dados,
  critérios e finalidade.
- Art. 19 — prazo de **15 dias** para a declaração completa. Sem processo definido,
  o prazo corre sem ninguém olhando.
- Art. 18, V — portabilidade: não existe.

Chama atenção que a exclusão, que é o direito mais difícil de implementar, esteja
pronta, e o acesso, que é o mais fácil, não.

### 7. Não há canal declarado para o titular exercer direitos (art. 18)

Existe chat de suporte, existe WhatsApp, existe e-mail no rodapé. Nenhum deles está
declarado como o canal de LGPD, e ninguém no atendimento tem instrução de reconhecer
"quero meus dados" como pedido com prazo legal.

---

## O que está errado

Aqui não é ausência — é código que existe e diverge do que promete.

### 8. A tela de exclusão mente sobre as conversas de suporte

[exclusaoDeConta.ts:56](../../src/lib/exclusaoDeConta.ts) diz ao titular:

> **Conversas de suporte** — Ficam vinculadas ao CNPJ da empresa, para a equipe
> conseguir retomar um atendimento em aberto.

O banco diz o contrário:

```sql
-- 20260701150000_support_chat.sql:5
customer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
-- 20260701150000_support_chat.sql:24
sender_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
```

Reafirmado em `20260806160000_support_conversations_integridade.sql:27`. Quando a
conta é apagada, **a conversa inteira e todas as mensagens vão junto, em cascata**.
Não sobra nada vinculado ao CNPJ.

O cabeçalho do próprio arquivo justifica a retenção com "as tabelas confirmam —
`orders` e `support_conversations` são chaveadas por `customer_cnpj`, não por
`user_id`". Para `orders` isso é verdade. Para `support_conversations` não é: a
tabela tem `customer_cnpj` **e** `customer_user_id NOT NULL`, e é o segundo que
manda na hora de apagar.

Isso é violação de transparência (art. 9º) e contraria a §27 do padrão de
autenticação que o próprio arquivo cita. **Uma das duas pontas tem que ceder** — ou
o texto passa a dizer que a conversa é apagada, ou o FK vira `ON DELETE SET NULL`
com anonimização das colunas `customer_name`/`customer_phone`. É decisão de negócio,
não de código: a equipe precisa mesmo do histórico de atendimento depois que a
pessoa sai?

### 9. O `user_id` das avaliações continua legível por qualquer cliente logado

A migration `20260807200000_avaliacoes_sem_user_id_corrigido.sql` é um trabalho
bom: descobriu que `revoke select (coluna)` não subtrai de um grant de tabela,
derrubou o grant e reconcedeu coluna a coluna. Mas fez isso **só para `anon`**:

```sql
revoke select on table "clinic+b2b_product_reviews" from anon;
grant select (id, product_id, rating, ...) ... to anon;
```

`authenticated` nunca foi tocado. O grant original continua de pé:

```sql
-- 20260804120000_clinic_b2b_rls_policies.sql:655
GRANT SELECT ON TABLE public."clinic+b2b_product_reviews" TO anon, authenticated;
```

E a policy de leitura é `USING (true)` para `anon, authenticated`. Resultado: um
cliente logado pede `/rest/v1/clinic+b2b_product_reviews?select=user_id,product_id,rating,comment`
e recebe a autoria de todas as avaliações do site.

**Correção de 19/08/2026 — o achado era maior do que este parágrafo dizia.**
Eu havia escrito que se tratava de um pseudônimo, UUID e não nome, e que a
gravidade era média. Ao implementar a correção, dois fatos apareceram:

1. **A RPC passa por cima do privilégio de coluna.** `get_product_reviews` é
   `security definer` e declara `user_id` na assinatura. Fechar a tabela sem
   tocar nela seria trancar a porta e deixar a janela aberta — e é o que a
   migration original fez para `anon`.
2. **Ela também devolve o nome real.** A função faz `left join` com
   `customer_profiles` e retorna `p.name` como `user_name`, que a página do
   produto exibe ao lado da avaliação. Não é vazamento escondido: é recurso de
   produto, visível. Mas é o nome de quem cadastrou a empresa, mostrado a todo
   cliente logado, sem estar declarado em lugar nenhum — o que devolve o assunto
   para o art. 9º.

Ambas as partes estão corrigidas:

- `20260819120000` — o `user_id` volta preenchido só para o próprio autor, e o
  grant de tabela de `authenticated` cai.
- `20260819140000` — o `user_name` passa a ser abreviado no **banco**:
  `Felipe Fernandes Silva` chega ao navegador como `Felipe S.`. Abreviar na tela
  deixaria o nome inteiro viajar até o cliente, visível no inspetor. Minimização
  (art. 6º, III) só vale quando o dado não sai.

### 10. Nome do cliente em log claro, enquanto o CNPJ é mascarado

```
proxis-order.ts:902   console.log("[proxis-order] Cliente nao encontrado, criando novo:", nomeCliente)
bitrix-deal.ts:145    console.log("[bitrix-deal] Criando deal para:", body.customer_company || body.customer_name, ...)
```

O CNPJ passa por `mascararCnpj` duas linhas acima; o nome vai inteiro. Log de Vercel
é retido por prazo que não controlamos e acessível a quem tem o painel. Minimização
pela metade é a que dá falsa sensação de resolvido.

### 11. `documentation/` está no `.gitignore` — e os documentos que o CLAUDE.md chama de fonte da verdade sumiram

O `.gitignore` tem `documentation/`. Nenhum commit jamais tocou a pasta
(`git log -- documentation/` volta vazio). E os três arquivos que o
[CLAUDE.md](../../CLAUDE.md) declara como fonte da verdade da frente de
autenticação — `AUTH.MD`, `PERFIL-CLINIC-PLUS.md`, `EXCECOES-REGISTRADAS.md` —
**não existem em lugar nenhum do disco**. O `find` não acha.

O próprio CLAUDE.md antecipou: *"Depois de uma transferência de máquina, é o risco
número um."* Aconteceu.

Para a LGPD isso não é detalhe de organização. O art. 37 e o princípio de
responsabilização (art. 6º, X) se demonstram **com documento**. Registro de
tratamento, base legal, análise de impacto e decisão de retenção que vivem só numa
pasta ignorada pelo Git não sobrevivem à próxima troca de máquina — e uma
conformidade que não sobrevive não é conformidade.

**Isto inclui a pasta LGPD que acabamos de montar.** Ela também não está versionada.

---

## O que depende de decisão sua

Não dá para responder lendo código.

| Pergunta | Por que importa |
|---|---|
| **Em que região está o projeto Supabase?** | Se o banco está fora do Brasil, é transferência internacional (arts. 33 a 36) e precisa de base — cláusulas-padrão, cláusulas específicas ou adequação. Vale o mesmo para a região das funções na Vercel |
| **Onde roda o Bitrix24, e há contrato de tratamento?** | Ele recebe nome, CNPJ, telefone e e-mail ([bitrix-deal.ts](../../api/bitrix-deal.ts)). É operador (art. 39) e possivelmente transferência internacional |
| **Contrato de operador com Proxsys, Supabase, Vercel e OpenAI** | Art. 39 exige que o operador trate conforme instruções do controlador. Isso vive em contrato, não em código |
| **Qual a base legal das notificações de campanha, e onde fica o opt-out?** | Marketing não cabe em execução de contrato. Precisa de consentimento ou de legítimo interesse com oposição |
| **Prazos de retenção** | Pedido tem guarda fiscal — quantos anos? Conversa de suporte, trilha de auditoria e favoritos, quanto tempo? Sem número, o art. 16 não fecha |
| **A equipe precisa da conversa de suporte após a exclusão da conta?** | É o que decide o achado 8 |
| **Quem é o encarregado?** | Pessoa ou empresa, com contato público (art. 41) |
| **`documentation/` sai do `.gitignore`?** | Decide se a documentação de conformidade sobrevive à próxima máquina |

---

## Ordem sugerida

**Primeiro — barato e some com a maior parte da exposição**

1. Tirar `documentation/` do `.gitignore`, ou ao menos abrir exceção para
   `documentation/LGPD/`. Sem isso, todo o resto se perde de novo.
2. Escrever o aviso de privacidade e publicá-lo em `/privacidade`, com link no
   rodapé e no formulário de cadastro. Nomear o encarregado ali.
3. Corrigir o texto da exclusão de conta (achado 8) — ou o texto, ou o modelo.
4. Fechar o `user_id` das avaliações para `authenticated` (achado 9).
5. Tirar o nome do cliente dos logs (achado 10).

**Depois — precisa de decisão e de processo**

6. Registro das operações de tratamento (art. 37), com base legal e retenção por
   operação. É o documento que organiza todo o resto.
7. Runbook de incidente com os 3 dias úteis, dono nomeado e login do SEI! testado
   antes de precisar.
8. Prazos de retenção implementados: agendar a limpeza de dispositivos que já
   existe, definir teto para `auth_events` e `rate_limit`.
9. Tela "meus dados" com exportação (art. 18, II e V) e canal declarado para
   pedidos de titular, com o relógio de 15 dias visível para quem atende.

**Aberto, e sem pressa de decidir errado**

10. Transferência internacional: confirmar as regiões, e então escolher a base.
11. Consentimento e opt-out das campanhas.

---

## Nota de método

Análise estática, sem sondagem de produção. Três coisas que este arquivo **não**
verificou e que podem mudar conclusões:

- A configuração real do Supabase — região, retenção de backup, quem tem acesso ao
  painel, e se `auth.audit_log_entries` voltou a gravar.
- Os contratos com Proxsys, Bitrix, Supabase, Vercel e OpenAI.
- O que os administradores efetivamente fazem com o acesso que têm. A RLS permite
  que admin leia todo perfil de cliente, e **nenhum acesso de admin a dado pessoal
  é registrado em trilha** — o gatilho de auditoria cobre autenticação, não leitura
  de cadastro. Se algum dia for preciso responder "quem viu o cadastro deste
  cliente", hoje não há resposta.
