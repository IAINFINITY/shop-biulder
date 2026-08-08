# Clinic+ B2B — estado do projeto

Onde o trabalho está, o que decide o que, e o que continua em aberto.

**Atualizado em:** 2026-08-08 · **Base:** `20457db` mais um bloco grande de
alterações **ainda não commitadas** (a frente de autenticação inteira).

---

## Estado da verificação

| Verificação | Resultado |
|---|---|
| `npm run build` | passa |
| `npx tsc --noEmit -p tsconfig.app.json` | limpo |
| `tsc --strict` sobre `api/*.ts` | limpo |
| `npm run lint` | 0 erros, 10 warnings |
| `npm run test` | **414 testes / 44 arquivos**, todos verdes |

Os 10 warnings são pré-existentes (`react-hooks/exhaustive-deps` e
`react-refresh`) e não estão nos arquivos da frente de autenticação.

> ⚠️ **Há muita coisa não commitada.** A frente de autenticação — MFA, rate
> limit, senha vazada, exclusão de conta, 8 migrations — vive só no working tree.
> Depois de uma transferência de máquina, é o risco número um.

---

## A frente atual: autenticação

O trabalho **não** é conduzido por este arquivo. A fonte da verdade é:

| Documento | Papel |
|---|---|
| `documentation/autenticacao/AUTH.MD` | O padrão, com parágrafos numerados (§5, §10, §11, §12, §16, §19, §21, §24, §31…) |
| `documentation/autenticacao/PERFIL-CLINIC-PLUS.md` | Perfil de implementação exigido pela §33: cada não conformidade, com evidência e status |
| `documentation/autenticacao/EXCECOES-REGISTRADAS.md` | Exceções formais — EX-001 (`localStorage`), EX-002 (WebAuthn, encerrada), EX-003 (senha em 10) |

**Antes de mexer em autenticação, leia o PERFIL.** Ele diz o que já está conforme
e por quê; refazer análise por cima dele é desperdício, e contrariá-lo sem ler é
como se abre não conformidade nova.

Quando o perfil divergir do repositório, **o repositório é a verdade** — já
aconteceu de o documento ficar para trás do código (itens 3.7 e 3.11, corrigidos
em 2026-08-08).

### Onde a autenticação está

**Conforme:** bucket de imagens só admin (3.0) · headers + CSP (3.4) · `signOut`
global (3.5) · rate limit nas 8 rotas (3.6) · `user_id` fora das avaliações (3.8)
· isolamento da tabela de preço (3.10) · política de senha (3.2b).

**MFA (3.2) — código completo, virada operacional pendente.** Três camadas:
`src/lib/mfa.ts` (regra pura, lê o `aal` de dentro do JWT assinado), `api/_auth.ts`
(**é aqui que a segurança mora** — rota `adminOnly` recusa token sem `aal2`) e
`MfaGate` (o painel nem monta antes do `aal2`). Passkey oferecido ao lado do TOTP.

**Auditoria (3.7) — construída.** `clinic+b2b_auth_events`, alimentada por gatilho
no schema `auth`, nunca pelo navegador. Falta só falha de login, que não gera
linha para o gatilho ver.

---

## Em aberto

### Depende de decisão sua — não dá para resolver sozinho

| Item | Por que precisa de você |
|---|---|
| **Ligar `MFA_ADMIN_OBRIGATORIO=1`** | Só depois que todo admin cadastrar o fator. O medidor é o `console.warn` `[auth] admin ... sem aal2`: quando sumir dos logs, pode ligar |
| **Ligar `PRICING_ENFORCE_SERVER_PRICE=1`** | Depende de conferir os logs `[proxis-order] Preço do navegador diferente do servidor` por alguns dias |
| **RP ID de produção** | `VITE_WEBAUTHN_RP_ID` está em `localhost` (teste). O valor de produção é o domínio real, e **mudar depois invalida todo passkey já criado** — definir antes dos primeiros cadastros |
| **3.1 Token em `localStorage`** | BFF com cookie `__Host-` **ou** manter a exceção EX-001. Decisão de arquitetura e custo |
| **3.3 Fluxo implicit** | Configuração no painel do Supabase, fora do repositório |
| **Notificação de troca de credencial (§19)** | Depende de contratar provedor de e-mail transacional |
| **3.9 Campos do perfil** | SLA de revogação, classificação de alto valor, retenção — decisão de negócio |

### Pendências menores, sem urgência

| Item | Local | Observação |
|---|---|---|
| Binding e eventos por autenticador (§19) | `AutenticadoresSection` | Criação e último uso já aparecem. Falta binding e a lista de eventos — a trilha já tem os dados, falta a tela |
| Arquivos grandes | `Account.tsx`, `Index.tsx`, `SupportChatPanel.tsx`, `AdminWorkspace.tsx`, `proxis-order.ts` | Todos por volta de 1000–1200 linhas |

**Resolvidos em 2026-08-08:** rodízio de representante (era contador de módulo,
virou hash da `submission_key` — sem estado e determinístico) · busca sequencial
de produtos (paralelizada com teto de 5 via `mapearComLimite`) · último uso do
autenticador (migration `20260808130000`).

O bloco `let n8nProxy = ""` em `proxis-order.ts` **não** é pendência: tem
comentário e `eslint-disable` marcando que o caminho do proxy está desligado de
propósito enquanto a rota direta está em uso.

---

## Convenções que não são óbvias no código

**Lógica pura em `src/lib`, I/O em `api/`.** É o que permite testar a regra sem
subir servidor. `proxisTpr.ts`, `proxisOrderStatusStore.ts`, `apiAuth.ts`,
`mfa.ts` e `serverPricing.ts` seguem isso: nenhum toca `process.env`.

**Import com `.js` nas rotas.** `api/*.ts` importa `../src/lib/x.js` — é o que a
Vercel resolve, e o dev local tem um `tsResolveHook.mjs` que mapeia `.js` → `.ts`.
O alias `@/` **não** existe no runtime serverless; usá-lo em arquivo importado por
`api/` quebra em produção sem quebrar no teste.

**Nomes de tabela repetidos em `api/_auth.ts` e `api/_pricing.ts`.** Não é
descuido: importar de `customerProfile.ts` arrastaria o SDK do navegador para
dentro da função serverless. **Se um nome mudar no banco, mude nos dois lugares:**

```
clinic+b2b_customer_profiles
clinic+b2b_customer_price_overrides
clinic+b2b_clinic_catalogo_front_b2b
```

**Migrations são a verdade do banco, não os `APLICAR_NO_SUPABASE_*.sql`.** Esses
arquivos soltos não dizem o que está no ar — foi assim que o vazamento da tabela
de preço (3.10) passou despercebido até alguém consultar `pg_policies` direto.

**Front e API sobem no mesmo deploy.** A API sozinha derruba o checkout com 401.

---

## Nota de método

A análise que originou este arquivo foi estática: leitura do repositório mais
`build`, `lint`, `tsc` e `test`. As sondagens contra o Supabase de produção estão
registradas no PERFIL, com data. Nada foi validado contra a Proxsys ou o Bitrix em
execução.
