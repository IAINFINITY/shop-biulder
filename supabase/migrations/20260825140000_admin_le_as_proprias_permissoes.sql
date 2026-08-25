-- O admin passa a conseguir ler as próprias permissões.
--
-- ## O sintoma
--
-- `comercial4@botta.com.br` tinha **todas** as caixas marcadas no painel,
-- inclusive "Funcionários", e mesmo assim não via a área de Funcionários.
--
-- ## A causa
--
-- A tabela `clinic+b2b_admin_users` tinha uma única policy de SELECT, e ela
-- exige `clinic_b2b_is_superadmin()`. Quem não é superadmin **não lê nem a
-- própria linha** — conferido simulando o JWT dela: 0 linhas.
--
-- O painel busca as permissões com `.single()`. Sem linha visível, a consulta
-- devolve erro e `adminPermissions` fica `undefined`. Aí, em
-- `canAccessAdminSection`:
--
--   - `funcionarios` exige `permissions?.funcionarios === true`
--     → `undefined === true` → **false**, some do menu;
--   - todas as outras caem em `if (!options.permissions) return true`
--     → **true**, aparecem normalmente.
--
-- Ou seja, o sintoma exato relatado: vê tudo, menos Funcionários.
--
-- ## O que isto muda além do sintoma
--
-- Muito mais do que parece. Como a leitura **sempre** falhava, o sistema de
-- permissões era inerte: qualquer admin via todas as seções, marcadas ou não.
-- `comercial9@botta.com.br` está com `precos: false` desde sempre e enxerga
-- Preços hoje.
--
-- Com esta policy as permissões passam a valer de verdade. Não é efeito
-- colateral — é a tela finalmente fazendo o que a configuração já dizia. Mas
-- alguém vai perder acesso que tinha na prática, e isso é esperado.
--
-- ## Por que a própria linha basta
--
-- Ler as próprias permissões não revela nada: a pessoa já descobre o mesmo
-- conjunto navegando pelo menu. A listagem de **todos** os admins continua
-- restrita ao superadmin pela policy que já existia — policies permissivas se
-- somam com OR, então esta não afrouxa aquela.
--
-- Nada de UPDATE aqui: alterar as próprias permissões continua sendo
-- exclusividade do superadmin, via `update_admin_permissions`.

drop policy if exists "Clinic B2B admin reads own row" on public."clinic+b2b_admin_users";

create policy "Clinic B2B admin reads own row"
  on public."clinic+b2b_admin_users"
  for select
  to authenticated
  using (user_id = auth.uid());
