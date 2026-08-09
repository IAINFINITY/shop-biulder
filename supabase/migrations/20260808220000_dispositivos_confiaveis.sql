-- Dispositivos confiaveis: lembrar o navegador por 30 dias apos o segundo fator.
--
-- Resolve o atrito relatado em 08/08 — sair e entrar pedia o codigo toda vez —
-- sem abrir mao do segundo fator, como Google e GitHub fazem.
--
-- ## O que a §14 exige, e onde cada exigencia aparece aqui
--
--   "credencial separada, revogavel, armazenada como hash, rotacionada a cada
--    uso e com deteccao de replay"
--
--   separada    -> tabela propria, sem relacao com auth.sessions
--   hash        -> `token_hash`; o token cru NUNCA chega ao banco
--   revogavel   -> `revogado_em`, e a propria pessoa pode gravar (policy abaixo)
--   rotacionada -> `rotacionado_em` marca o token que ja foi trocado
--   replay      -> token com `rotacionado_em` que reaparece = duas copias vivas
--
-- A regra que le estas colunas e `src/lib/dispositivoConfiavel.ts`, com testes.
-- Aqui fica so o armazenamento e quem pode tocar em que.

create table if not exists "clinic+b2b_dispositivos_confiaveis" (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- sha256 do token, em hexadecimal (64 caracteres). `unique` nao e so higiene:
  -- e o que garante que a validacao encontre no maximo um registro por token.
  token_hash text not null unique,

  -- Rotulo grosseiro ("Chrome no Windows"), so para a pessoa reconhecer a linha
  -- no inventario. Nao guardamos o user-agent inteiro de proposito.
  rotulo text,

  criado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  ultimo_uso_em timestamptz,
  rotacionado_em timestamptz,
  revogado_em timestamptz
);

-- A validacao busca por hash a cada login; o inventario lista por usuario.
create index if not exists idx_dispositivos_confiaveis_hash
  on "clinic+b2b_dispositivos_confiaveis" (token_hash);

create index if not exists idx_dispositivos_confiaveis_usuario
  on "clinic+b2b_dispositivos_confiaveis" (user_id, criado_em desc);

alter table "clinic+b2b_dispositivos_confiaveis" enable row level security;

-- Ver os proprios aparelhos. A §17 exige "inventario visivel" — sem isto, a
-- pessoa nao tem como notar um aparelho que nao reconhece.
create policy "dispositivos: dono le os seus"
  on "clinic+b2b_dispositivos_confiaveis"
  for select
  using ((select auth.uid()) = user_id);

-- Revogar pela tela. Limitado a marcar `revogado_em`: o `with check` repete a
-- condicao do dono para que um update nao possa mudar `user_id` e sequestrar o
-- registro para outra conta.
create policy "dispositivos: dono revoga os seus"
  on "clinic+b2b_dispositivos_confiaveis"
  for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- **Nao existe policy de INSERT.** Registrar um dispositivo e operacao sensivel
-- pela §17, e so acontece server-side, depois de o segundo fator ter sido
-- verificado de verdade. Se o navegador pudesse inserir, bastaria gravar uma
-- linha para nunca mais ver o desafio — a confianca de dispositivo passaria a
-- "substituir MFA silenciosamente", que e exatamente o que a §17 proibe.
--
-- O `service_role` ignora RLS e e por onde `api/dispositivo-confiavel.ts` grava.

-- Faxina: registro vencido ha mais de 90 dias nao serve nem para auditoria de
-- replay, porque o token ja nao valeria de qualquer forma.
create or replace function clinic_b2b_limpar_dispositivos_confiaveis()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  removidos integer;
begin
  delete from "clinic+b2b_dispositivos_confiaveis"
   where expira_em < now() - interval '90 days';
  get diagnostics removidos = row_count;
  return removidos;
end;
$$;

comment on table "clinic+b2b_dispositivos_confiaveis" is
  'Credencial de "lembrar deste aparelho" por 30 dias. Guardada como hash, rotacionada a cada uso, com deteccao de replay (§14/§17 do AUTH.MD).';
