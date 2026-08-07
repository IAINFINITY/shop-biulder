-- Resumo do produto escrito por IA.
--
-- O card "Resumo" da pagina do produto recorta as primeiras frases da descricao.
-- Funciona nos 64 produtos com descricao curta; nos 40 com mais de 3 mil
-- caracteres o recorte pega o comeco do texto de marketing em vez do que a
-- pessoa precisa saber.
--
-- A coluna guarda **um item por linha**, texto puro. Nao e JSON porque nao ha
-- nada para consultar aqui: o campo e lido inteiro e escrito inteiro, e texto
-- deixa o conteudo legivel para quem abrir a tabela no painel do Supabase.
--
-- Nula e o estado normal, nao um defeito: produto sem resumo continua mostrando
-- o recorte da descricao, como sempre mostrou. Nada precisa ser preenchido de
-- uma vez — cada produto ganha o seu quando alguem gerar pelo formulario.

alter table "clinic+b2b_clinic_catalogo_front_b2b"
  add column if not exists ai_summary text;

comment on column "clinic+b2b_clinic_catalogo_front_b2b".ai_summary is
  'Resumo do produto, um item por linha. Gerado por IA no painel e revisado por pessoa antes de salvar. Nulo = a pagina usa o recorte da descricao.';
