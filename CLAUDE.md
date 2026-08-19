# Clinic+ B2B — estado do projeto

Onde o trabalho está, o que decide o que, e o que continua em aberto.

**Atualizado em:** 2026-08-19 · **Base:** `10c54d5`, working tree limpo.

---

## Estado da verificação

| Verificação | Resultado |
|---|---|
| `npm run build` | passa |
| `npx tsc --noEmit -p tsconfig.app.json` | limpo |
| `tsc --strict` sobre `api/*.ts` | limpo |
| `npm run lint` | 0 erros, 7 warnings |
| `npm run test` | **573 testes / 59 arquivos**, todos verdes |
| `npx playwright test` | 13 testes de navegador (Chromium e WebKit) |

Os 7 warnings são pré-existentes (`react-hooks/exhaustive-deps` e
`react-refresh`). Eram 10; três sumiram com a remoção de código morto.

**A árvore está limpa.** O bloco não commitado que este arquivo alertava foi
commitado; a limpeza de código morto e a suíte de testes vieram depois, em sete
commits (`8b7b1a9`…`10c54d5`).

---

## A frente atual: autenticação

> ⚠️ **Os três documentos que esta seção citava não existem mais.**
> `documentation/autenticacao/AUTH.MD`, `PERFIL-CLINIC-PLUS.md` e
> `EXCECOES-REGISTRADAS.md` eram declarados aqui como a fonte da verdade da
> frente de autenticação. Em 19/08/2026 foram procurados no disco inteiro e não
> foram encontrados; `git log -- documentation/` volta vazio, porque a pasta
> estava no `.gitignore`. Perderam-se numa troca de máquina — o risco que este
> próprio arquivo antecipava.
>
> A pasta passou a ser versionada na mesma data. O que sobrou como fonte da
> verdade da autenticação é **o código e as migrations**; as referências abaixo
> a parágrafos numerados (§10, §14, §17, §19, §24, §27…) apontam para um padrão
> que não está mais disponível, e ficam apenas como rastro de intenção.

O trabalho **não** é conduzido por este arquivo.

Quando o perfil divergir do repositório, **o repositório é a verdade** — já
aconteceu de o documento ficar para trás do código (itens 3.7 e 3.11, corrigidos
em 2026-08-08).

### Onde a autenticação está

**Conforme:** bucket de imagens só admin (3.0) · headers + CSP (3.4) · `signOut`
global (3.5) · rate limit nas 8 rotas (3.6) · isolamento da tabela de preço (3.10)
· política de senha (3.2b).

O item 3.8 (`user_id` fora das avaliações) estava marcado como conforme e **não
estava**: a correção original fechou a coluna só para `anon`, e a RPC
`get_product_reviews`, sendo `security definer`, devolvia a autoria para
qualquer cliente logado. Fechado de verdade na migration `20260819120000`,
validada contra produção com duas contas reais.

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
| ~~**RP ID de produção**~~ | **Resolvido.** Conferido na Vercel em 19/08/2026: `VITE_WEBAUTHN_RP_ID="catalogo-clinicmais.iainfinity.com.br"`. Não é mais `localhost`. Continua valendo que mudá-lo invalida todo passkey já criado |
| **3.1 Token em `localStorage`** | BFF com cookie `__Host-` **ou** manter a exceção EX-001. Decisão de arquitetura e custo |
| **3.3 Fluxo implicit** | Configuração no painel do Supabase, fora do repositório |
| **Notificação de troca de credencial (§19)** | Depende de contratar provedor de e-mail transacional |
| **3.9 Campos do perfil** | SLA de revogação, classificação de alto valor, retenção — decisão de negócio |
| **Encarregado de dados (LGPD, art. 41)** | **Trava a publicação do aviso de privacidade.** A lei exige identidade *e* contato públicos. O contato já existe: `lgpd@clinicmais.com.br`, anunciado na política do site principal desde 2022 — falta saber **quem responde essa caixa** e publicar o nome. Enquanto isso, `/privacidade` não sobe, o canal do titular não é declarado, e a tabela de responsáveis do runbook de incidente fica em branco. Rascunho pronto em `documentation/LGPD/AVISO-DE-PRIVACIDADE-RASCUNHO.md`, com o campo marcado `⟨nome⟩` |
| **Gancho de falha de login** | `hook_password_verification_attempt` é pago no Supabase: a API devolveu 402 em 20/08/2026. A função `registrar_tentativa_de_senha` já existe e funciona; ligar exige subir o plano. Até lá, força bruta não aparece na trilha |

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

**Migrations são a verdade do banco.** Os 33 `APLICAR_NO_SUPABASE_*.sql` foram
apagados em 19/08/2026 (`8b7b1a9`): não diziam o que estava no ar e pareciam
dizer — foi assim que o vazamento da tabela de preço (3.10) passou despercebido
até alguém consultar `pg_policies` direto.

**Front e API sobem no mesmo deploy.** A API sozinha derruba o checkout com 401.

---

## Nota de método

A análise que originou este arquivo foi estática: leitura do repositório mais
`build`, `lint`, `tsc` e `test`. As sondagens contra o Supabase de produção
ficavam registradas no PERFIL, que se perdeu — as de 19/08/2026 estão em
`documentation/LGPD/AUDITORIA-LGPD.md`, agora versionado. Nada foi validado
contra a Proxsys ou o Bitrix em execução.

**LGPD.** O diagnóstico está em `documentation/LGPD/AUDITORIA-LGPD.md` e o plano
de trabalho em `documentation/planejamento/PLANO_LGPD.MD`. Duas decisões travam
o resto: quem é o encarregado (art. 41) e o texto do aviso de privacidade.
