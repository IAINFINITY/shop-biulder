-- Reset de senha para o padrão provisório, feito pelo painel.
--
-- ## Por que existe
--
-- O painel criava funcionário com senha provisória, mas não tinha como
-- **devolver** uma conta a esse estado. Quando alguém não conseguia entrar — foi
-- o caso de `su.cassol@hotmail.com` em 24/08/2026, uma conta recriada em 04/08
-- que nunca chegou a fazer login — a única saída era mexer no banco à mão.
--
-- ## Por que é uma função no banco, e não `auth.admin.updateUserById`
--
-- Porque a API recusa. Medido em 24/08/2026 contra este projeto:
--
--   PUT /auth/v1/admin/users/{id}  password=Alterar@123
--     -> 422 weak_password { reasons: ["pwned"] }
--
-- A proteção de senha vazada do Supabase roda no **update**, e `Alterar@123`
-- está na lista pública de senhas vazadas. A mesma senha passa sem reclamação no
-- **create**:
--
--   POST /auth/v1/admin/users   password=Alterar@123  -> 200
--
-- Ou seja: a proteção já não se aplica ao caminho pelo qual todo funcionário
-- nasce. Esta função não abre uma exceção nova — ela faz o reset se comportar
-- como a criação, que é o comportamento que o painel promete.
--
-- **O que isso custa:** a senha padrão é sabidamente vazada, e a proteção do
-- Supabase estava certa em apontar. O que segura o risco é a janela: a conta sai
-- daqui com `deve_trocar_senha = true` e o site bloqueia tudo até a troca. Se um
-- dia a senha padrão mudar para uma fora da lista, esta função pode ser trocada
-- por uma chamada comum à API admin.
--
-- ## O que ela NÃO faz
--
-- Não aceita senha escolhida por quem chama. O valor vem sempre de
-- `clinic+b2b_config_seguranca` — o mesmo que a função de borda de criação lê.
-- Um parâmetro de senha aqui transformaria o botão do painel em "defina a senha
-- de outra pessoa", que é coisa diferente de "devolva ao padrão".

create or replace function public.resetar_senha_para_o_padrao(alvo uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  padrao text;
  atingidas int;
begin
  select valor into padrao
    from public."clinic+b2b_config_seguranca"
   where chave = 'senha_padrao_funcionario';

  if padrao is null or length(padrao) = 0 then
    raise exception 'senha padrão não configurada em clinic+b2b_config_seguranca';
  end if;

  update auth.users
     set encrypted_password = extensions.crypt(padrao, extensions.gen_salt('bf', 10)),
         updated_at = now()
   where id = alvo;

  get diagnostics atingidas = row_count;
  if atingidas = 0 then
    raise exception 'usuário % não encontrado', alvo;
  end if;

  -- Sem isto o reset seria só "troquei a senha dele": a pessoa entraria com a
  -- provisória e ficaria nela. A troca obrigatória é o que fecha a janela em que
  -- o admin conhece a senha de outra pessoa (§8).
  update public."clinic+b2b_customer_profiles"
     set deve_trocar_senha = true
   where user_id = alvo;

  -- As sessões abertas morrem junto. Se a conta foi resetada por suspeita de
  -- acesso indevido, deixar a sessão de pé anularia o motivo do reset.
  delete from auth.sessions where user_id = alvo;
  delete from auth.refresh_tokens where user_id = alvo::text;

  -- A trilha registra o evento, nunca a senha. Quem lê a auditoria precisa saber
  -- que a credencial foi trocada por terceiro e quando — o valor não acrescenta
  -- nada e transformaria a tabela num depósito de segredo.
  insert into public."clinic+b2b_auth_events" (evento, user_id, detalhe)
  values ('senha_resetada_para_o_padrao', alvo, jsonb_build_object('origem', 'painel'));

  return padrao;
end;
$$;

comment on function public.resetar_senha_para_o_padrao(uuid) is
  'Devolve a conta à senha provisória de clinic+b2b_config_seguranca, marca troca obrigatória e encerra as sessões. Só service role.';

-- Ninguém que venha do navegador chama isto. `security definer` sobre
-- `auth.users` sem esta revogação seria trocar a senha de qualquer conta a partir
-- de um cliente logado — a falha mais grave que este arquivo poderia introduzir.
revoke all on function public.resetar_senha_para_o_padrao(uuid) from public;
revoke all on function public.resetar_senha_para_o_padrao(uuid) from anon;
revoke all on function public.resetar_senha_para_o_padrao(uuid) from authenticated;
grant execute on function public.resetar_senha_para_o_padrao(uuid) to service_role;
