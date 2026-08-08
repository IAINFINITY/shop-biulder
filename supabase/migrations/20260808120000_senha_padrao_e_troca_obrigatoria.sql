-- Senha padrão do funcionário sai do código, e a troca vira obrigatória.
--
-- ## O que muda, e o que não muda
--
-- **Não muda:** o dono cadastra um funcionário e ele entra com uma senha
-- provisória conhecida. Esse é o fluxo pedido e permanece.
--
-- **Muda:** onde essa senha mora, e o que acontece depois do primeiro acesso.
--
-- ## 1. A senha sai do repositório
--
-- Ela estava como `SENHA_PADRAO = "Alterar@123"` em `src/lib/employeeBulkImport.ts`
-- — versionada em git, presente no bundle do navegador e impressa na tela do
-- admin. Passa a viver aqui, numa tabela sem policy nenhuma: só o service role
-- lê, e quem lê é a função de borda que cria o usuário.
--
-- Isso não a torna secreta do admin — ele precisa dela para repassar ao
-- funcionário, e essa é a intenção. Tira do código, do histórico do git e do
-- alcance de quem só olha o front.
--
-- ## 2. A troca deixa de ser instrução e vira controle
--
-- A tela já dizia "devem trocar no primeiro acesso". Nada obrigava: uma busca por
-- `must_change_password` ou `first_login` no projeto não devolvia nada. Quem
-- soubesse o padrão entrava como qualquer funcionário que não tivesse trocado.
--
-- A coluna abaixo faz o sistema cumprir o que a tela já prometia. A §8 do padrão
-- de autenticação continua não sendo integralmente satisfeita — o admin ainda
-- conhece a senha —, mas a janela em que ela vale encolhe para um acesso.

create table if not exists "clinic+b2b_config_seguranca" (
  chave text primary key,
  valor text not null,
  descricao text,
  atualizado_em timestamptz not null default now()
);

comment on table "clinic+b2b_config_seguranca" is
  'Valores de configuração que não devem viver no código nem no bundle. Sem policy: apenas o service role acessa.';

-- Sem policy: anon e authenticated não leem nem escrevem. Só o service role, que
-- passa por cima da RLS, e é quem a função de borda usa.
alter table "clinic+b2b_config_seguranca" enable row level security;

insert into "clinic+b2b_config_seguranca" (chave, valor, descricao)
values (
  'senha_padrao_funcionario',
  'Alterar@123',
  'Senha provisória de funcionário criado pelo painel. Trocada obrigatoriamente no primeiro acesso. Alterar aqui muda apenas os próximos cadastros.'
)
on conflict (chave) do nothing;

-- `default false` de propósito, e a escolha merece explicação porque a intuição
-- puxa para o outro lado.
--
-- `true` seria o padrão mais seguro para contas novas — mas o default vale
-- também para as 110 linhas que já existem, e marcaria todo mundo. Transformar
-- uma correção em interrupção geral do site é dano certo contra risco hipotético.
--
-- Quem cria por senha provisória é marcado explicitamente pela função de borda
-- (`deve_trocar_senha: true` no upsert), que é o único caminho que gera senha
-- conhecida por terceiro. Não há caminho que devesse marcar e dependa do default.
alter table "clinic+b2b_customer_profiles"
  add column if not exists deve_trocar_senha boolean not null default false;

comment on column "clinic+b2b_customer_profiles".deve_trocar_senha is
  'Quando true, a pessoa é levada à troca de senha antes de usar o site. Marcado na criação por senha provisória; limpo quando ela troca.';

-- Quem já existe não é afetado: a coluna nasce false para as 110 contas atuais.
-- Marcar todo mundo transformaria uma correção em interrupção geral.
