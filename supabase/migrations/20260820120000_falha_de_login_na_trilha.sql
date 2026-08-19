-- Falha de login na trilha — funcao pronta, gancho AINDA NAO ATIVO.
--
-- ## Leia isto antes de assumir que esta funcionando
--
-- A funcao abaixo esta criada e correta, mas o gancho que a chamaria **nao pode
-- ser ligado no plano atual do Supabase**. Tentado em 20/08/2026 pela API de
-- gerenciamento:
--
--   PATCH /v1/projects/{ref}/config/auth
--   -> HTTP 402
--      "The following auth hooks cannot be configured for this organization:
--       HOOK_PASSWORD_VERIFICATION_ATTEMPT"
--
-- E limitacao de plano, nao de capacidade: `hook_before_user_created` ja roda
-- neste projeto (`block_public_signups`), entao o mecanismo funciona — este
-- gancho especifico e que e pago.
--
-- **Para ativar, depois de subir o plano**, basta uma chamada:
--
--   hook_password_verification_attempt_enabled = true
--   hook_password_verification_attempt_uri =
--     'pg-functions://postgres/public/registrar_tentativa_de_senha'
--
-- Nada mais precisa mudar. Ate la, falha de login continua sem aparecer em lugar
-- nenhum, e forca bruta segue invisivel.
--
-- ## A lacuna
--
-- A trilha `clinic+b2b_auth_events` e alimentada por gatilho em `auth.sessions` e
-- `auth.mfa_factors`. Isso cobre o que da certo — e so isso. Senha errada nao
-- cria sessao, entao nao ha linha para o gatilho ver, e **ataque de forca bruta
-- e exatamente o que nao aparecia**. A migration `20260808100000` registrou a
-- lacuna e deixou em aberto por depender de webhook.
--
-- `auth.audit_log_entries`, a tabela nativa, foi conferida de novo em 19/08/2026:
-- continua com zero linhas. A plataforma nao grava, entao o item nao se fecha
-- por configuracao.
--
-- ## Por que este caminho, e nao registro pelo navegador
--
-- O front poderia gravar ao receber o erro de login. Seria forjavel e, pior,
-- inutil justamente no caso que importa: quem faz forca bruta chama a API direto
-- e nao executa o nosso JavaScript. A trilha ficaria vazia na hora do ataque.
--
-- O `hook_password_verification_attempt` do Supabase resolve isso: e uma funcao
-- **no banco**, chamada pelo servico de autenticacao a cada tentativa de senha,
-- antes de responder. Nao ha como pular — quem tenta a senha passa por aqui,
-- venha do site, do celular ou de um script.
--
-- O projeto ja usa esse mecanismo em `block_public_signups`
-- (`20260804195000`), entao o padrao de permissao abaixo e o mesmo que ja
-- funciona neste banco.
--
-- ## O que entra na trilha, e o que nao entra
--
-- Entra: que houve tentativa invalida, de qual `user_id`, quando.
-- **Nao entra: a senha, hash, nem o e-mail digitado.** A §24 do padrao tem lista
-- de "nunca registrar", e trilha que vaza segredo vira o proprio alvo. Tentativa
-- com e-mail inexistente nao gera linha: o hook so e chamado quando ha usuario.

create or replace function public.registrar_tentativa_de_senha(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- So a falha interessa. Sucesso ja vira sessao, e a sessao ja tem gatilho —
  -- registrar aqui tambem duplicaria cada login bem-sucedido.
  if (event->>'valid')::boolean is false then
    insert into public."clinic+b2b_auth_events" (evento, user_id, detalhe)
    values (
      'senha_invalida',
      nullif(event->>'user_id', '')::uuid,
      jsonb_build_object('origem', 'hook_password_verification_attempt')
    );
  end if;

  -- O hook precisa devolver a decisao. Devolver o evento sem `decision` mantem o
  -- comportamento padrao do Supabase: esta funcao observa, nao bloqueia. Recusar
  -- login aqui seria mudar autenticacao a pretexto de auditar.
  return event;
exception
  when others then
    -- Trilha nao pode derrubar login. Se a insercao falhar, a tentativa segue o
    -- fluxo normal — o mesmo criterio do gatilho de `auth.sessions`.
    return event;
end;
$$;

revoke all on function public.registrar_tentativa_de_senha(jsonb) from public;
revoke all on function public.registrar_tentativa_de_senha(jsonb) from anon, authenticated;
grant execute on function public.registrar_tentativa_de_senha(jsonb) to supabase_auth_admin;

-- O servico de autenticacao escreve na trilha por dentro desta funcao, e ela e
-- `security definer` — mas o `insert` precisa do privilegio do dono, nao do
-- chamador. Garantido pelo `security definer`; nenhum grant extra na tabela.

comment on function public.registrar_tentativa_de_senha(jsonb) is
  'Hook de tentativa de senha: registra falha em clinic+b2b_auth_events. Observa, nunca bloqueia. Nunca grava senha, hash ou e-mail.';
