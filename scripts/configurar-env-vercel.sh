#!/usr/bin/env bash
# Variaveis da frente de autenticacao na Vercel.
#
# ## Como rodar, nesta maquina
#
#   & "C:\Program Files\Git\bin\bash.exe" scripts/configurar-env-vercel.sh
#
# O caminho completo nao e frescura: `bash` no PATH resolve para
# `C:\WINDOWS\system32\bash.exe`, o atalho do WSL, que aqui nao tem distribuicao
# instalada e falha com `execvpe(/bin/bash) failed: No such file or directory`.
# O Git Bash e o de `C:\Program Files\Git\bin`.
#
# ## Por que Bash, e nao PowerShell
#
# A primeira versao era `.ps1` e gravou os cinco valores com CRLF no fim. O pipe
# do PowerShell acrescenta uma quebra de linha ao mandar para o stdin de um
# programa nativo, e nao ha como desligar isso em `"valor" | comando`. A propria
# CLI avisou cinco vezes — `WARN! Value contains newlines` — e passou batido.
#
# O `printf '%s'` daqui nao acrescenta nada. E o motivo de o script ter mudado de
# linguagem em vez de ganhar um remendo.
#
# Quatro das cinco escaparam ilesas porque sao comparadas com `=== "1"`: lixo no
# fim so deixa o resultado falso, que ja era o valor desejado. A quinta nao —
# `VITE_WEBAUTHN_RP_ID` vai inteira para dentro da chamada WebAuthn, e o
# navegador exige que ela seja sufixo registravel da origem. Com `\r\n` no fim
# nao e, e o cadastro morre num `SecurityError` que nao aponta a causa. Ficaria
# adormecida ate alguem ligar o passkey — quebrando longe de quem mexeu.
#
# O `useMfa.ts` passou a aparar o valor de qualquer jeito. Isto aqui conserta a
# origem; aquilo protege contra a proxima.
#
# ## `--force`, entao rodar de novo e seguro
#
# Sobrescreve o que existir. O script e idempotente: rodar duas vezes deixa o
# mesmo estado.
#
# ## Todas entram DESLIGADAS, e isso e proposital
#
# As quatro flags sao lidas como `=== "1"`. Com "0", o comportamento e exatamente
# o de hoje — sao interruptores ficando visiveis no painel, nao mudanca no ar.
#
#   MFA_ADMIN_OBRIGATORIO=1        -> 403 para TODO admin. Nenhum dos 9 tem fator
#                                     verificado, e o painel e onde se cadastra.
#   PRICING_ENFORCE_SERVER_PRICE=1 -> recusa pedido com preco divergente. Antes,
#                                     conferir os logs "[proxis-order] Preco do
#                                     navegador diferente do servidor".
#   VITE_PASSKEY_HABILITADO=1      -> devolve o botao de biometria, que hoje
#                                     falha no clique: o Supabase recusa ligar
#                                     WebAuthn (422).
#
# As duas de MFA (`VITE_` e sem prefixo) sao a mesma decisao em lugares
# diferentes — navegador e servidor. Devem virar JUNTAS.
#
# ## Depois de rodar: precisa REDEPLOY
#
# As `VITE_*` sao assadas no bundle em tempo de build. As sem prefixo valem na
# proxima invocacao da funcao, sem redeploy.

set -euo pipefail
cd "$(dirname "$0")/.."

# printf '%s' — sem quebra de linha no fim. E o ponto do arquivo.
definir() {
  printf '  %-30s = %s\n' "$1" "$2"
  # Filtra so o ruido conhecido (banner de versao, aviso de atualizacao). Uma
  # versao anterior listava o que MOSTRAR — "Added|Error|WARN" — e engoliu a
  # confirmacao do `--force`, que nao diz "Added". A saida ficou sem nenhum sinal
  # de sucesso e so deu para saber que funcionara puxando os valores de volta.
  # Esconder por lista de permissao mente quando a mensagem muda; esconder por
  # lista de bloqueio, no maximo, mostra demais.
  printf '%s' "$2" | npx vercel env add "$1" "$3" --force 2>&1 \
    | grep -viE "^Vercel CLI|npm i -g|Update available|^$" | sed 's/^/      /' || true
}

for amb in production preview; do
  echo
  echo "=== $amb ==="
  definir VITE_MFA_ADMIN_OBRIGATORIO   0 "$amb"
  definir MFA_ADMIN_OBRIGATORIO        0 "$amb"
  definir VITE_PASSKEY_HABILITADO      0 "$amb"
  definir PRICING_ENFORCE_SERVER_PRICE 0 "$amb"
done

# So producao: preview roda em dominio `vercel.app`, e RP ID que nao casa com a
# origem e pior do que RP ID ausente — ausente cai no padrao do SDK, que acerta.
echo
echo "=== production (dominio real) ==="
definir VITE_WEBAUTHN_RP_ID catalogo-clinicmais.iainfinity.com.br production

echo
echo "Nenhum 'WARN! Value contains newlines' acima? Entao ficou limpo."
echo "Lembre do redeploy — as VITE_* so valem no proximo build."
