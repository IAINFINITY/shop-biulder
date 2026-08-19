# Com quem os dados são compartilhados

Levantado em 19/08/2026, lendo o código. **Nenhum contrato de operador foi
firmado ainda** — a decisão de tratar isso ficou para depois, e este arquivo
existe para que o levantamento não se perca até lá.

O art. 39 da LGPD exige que o operador trate os dados conforme as instruções do
controlador, e isso se estabelece em contrato. O art. 37 exige o registro das
operações. Este documento é a matéria-prima dos dois.

## A tabela

| Quem | O que recebe | Onde processa | Contrato |
|---|---|---|---|
| **Supabase** | Tudo: cadastro, pedido, conversa de suporte, trilha de acesso | `sa-east-1` — **São Paulo** | pendente |
| **Vercel** | Nome, CNPJ, telefone, e-mail, endereço — em trânsito pelas rotas `api/` | Função executa em `iad1` — **EUA** | pendente |
| **Proxsys / ProManager** | Cadastro do cliente e o pedido | Servidor próprio, IP brasileiro | pendente |
| **Bitrix24** | Nome, CNPJ, telefone, e-mail, itens do pedido | `grupobotta.bitrix24.com.br` — região a confirmar | pendente |
| **OpenAI** | **Só nome e descrição de produto** | EUA | pendente |
| **ViaCEP** | CEP digitado, a partir do navegador | Brasil | consulta pública |
| **BrasilAPI** | CNPJ digitado, a partir do navegador | Brasil (atrás de Cloudflare) | consulta pública |
| **cnpj.ws** | CNPJ digitado, a partir do navegador | Brasil | consulta pública |
| **HIBP** | **Nada.** Só 5 caracteres de um hash SHA-1 | EUA | não se aplica |

## Os dois pontos que exigem atenção

**As funções da Vercel rodam nos Estados Unidos.** Medido pelo header
`X-Vercel-Id`, que devolve `gru1::iad1::…`: a requisição entra por São Paulo
(`gru1`) e a função executa em Washington (`iad1`). `api/proxis-order.ts` e
`api/bitrix-deal.ts` processam nome, CNPJ, telefone e e-mail ali dentro.

É transferência internacional (arts. 33 a 36), ainda que nada fique armazenado
lá. E é o item mais fácil de resolver de toda a frente: `"regions": ["gru1"]` no
`vercel.json` traz a execução para São Paulo. De quebra, tira uma travessia do
Atlântico de cada chamada ao Supabase e ao Proxsys, os dois no Brasil.

**O Bitrix é o que menos se sabe.** O webhook aponta para
`grupobotta.bitrix24.com.br`, mas o domínio `.com.br` não garante servidor no
Brasil — o Bitrix24 na nuvem hospeda por região da conta, e isso se confere no
painel deles, não daqui. É quem recebe mais dado pessoal depois do Supabase.

## O que já é favorável

**O banco não sai do Brasil.** O Supabase está em `sa-east-1`, São Paulo — dado
e backup. É o maior volume de dado pessoal do sistema, e ele não atravessa
fronteira.

**A IA não vê cliente.** `api/resumo-produto.ts` manda para a OpenAI apenas nome
e descrição de produto. Nenhum dado de cliente segue por esse caminho, e vale
manter assim.

**O HIBP não recebe nada.** `src/lib/senhaVazada.ts` usa k-anonimato: o SHA-1 sai
do navegador com 5 caracteres, e a comparação acontece na máquina da pessoa. Nem
a senha nem o hash inteiro saem.

## O que falta, quando o assunto voltar

1. Contrato de operador com Supabase, Vercel, Proxsys, Bitrix e OpenAI (art. 39)
2. Confirmar a região do Bitrix24
3. Decidir sobre `"regions": ["gru1"]` no `vercel.json`
4. Escolher a base do art. 33 para o que sobrar de transferência internacional —
   cláusulas-padrão (art. 35) é o caminho usual
5. Levar esta tabela para o registro do art. 37, quando ele for escrito
