# Teste Proxis no n8n — ObterItens

## Importar o workflow

1. No n8n: **Workflows** → **Import from File**
2. Selecione `proxis-obter-itens.json`
3. Abra o nó **Config Proxis** e preencha:
   - `proxis_user` — mesmo do `.env` (`PROXSIS_USER`)
   - `proxis_password` — mesmo do `.env` (`PROXSIS_PASSWORD`)
    - `proxis_filial` — `5`
4. **Execute workflow** (botão *Test workflow*)

## URL gerada

```
http://177.38.10.218:8082/datasnap/rest/TSMApi/"ObterItens"
```

## Filtrar um produto (opcional)

No nó **Config Proxis**, em `filtro_produto`:

```
item.ite_numero = '7500'
```

## Authorization vermelho / `undefined` no n8n

O n8n **não suporta `Buffer`** em expressões de header. Por isso esta expressão falha:

```text
{{ 'Basic ' + Buffer.from($json.proxis_user + ':' + $json.proxis_password).toString('base64') }}
```

**Solução no workflow importado:** use o nó **Montar Authorization** (Code) antes do HTTP. No header use apenas:

```text
={{ $json.authorization }}
```

**Correção rápida sem reimportar:** no header `Authorization`, troque a expressão por `={{ $json.authorization }}` e adicione um nó **Code** entre Config e HTTP com o script do arquivo `proxis-obter-itens.json` (nó *Montar Authorization*).

**Alternativa:** no HTTP Request, em *Authentication* escolha **Basic Auth** e crie uma credencial com usuário/senha do `.env` (sem expressão).

## Só o nó HTTP (configuração manual)

Se preferir um único **HTTP Request** sem importar o JSON:

| Campo | Valor |
|--------|--------|
| Method | `GET` |
| URL | `http://177.38.10.218:8082/datasnap/rest/TSMApi/"ObterItens"` |
| Authentication | None (use header abaixo) |

**Headers:**

| Nome | Valor |
|------|--------|
| `Content-Type` | `application/json` |
| `Authorization` | `Basic BASE64(usuario:senha)` |
| `x-promanager-filial` | `5` |
| `X-ProManager-Pagina-Inicio` | `0` |
| `X-ProManager-Pagina-Quant` | `10` |

**Basic Auth no n8n:** em [https://www.base64encode.org](https://www.base64encode.org) encode `usuario:senha` e use `Basic <resultado>` no header `Authorization`.

**Opções do nó HTTP:** ative *Include Response Headers and Status* para ver se retorna 200 ou 404.

## Resposta esperada

- **Sucesso:** JSON array com produtos (`ite_id`, `ite_numero`, `ite_descricao`, …)
- **Erro:** HTML do IIS com título `404` — API indisponível ou URL incorreta nesta rede

## Workflow Proxy (`proxis-proxy.local.json`)

Este workflow serve de ponte entre a Vercel (cloud) e o Proxis (rede interna).

**Status:** ativo | **Total de nós:** 5 | **Tags:** proxy, proxis, webhook

**Como funciona:**
1. O webhook recebe `POST /proxis-proxy` com `{ endpoint, method, headers, body }`
2. O primeiro nó Code normaliza e valida o payload
3. O HTTP Request do n8n faz a chamada real ao Proxis
4. Um segundo nó Code normaliza a resposta
5. O webhook devolve o resultado ao sistema chamador

**Pontos de entrada**

| Tipo    | Caminho        | Método |
| ------- | -------------- | ------ |
| Webhook | `proxis-proxy` | POST |

**Regras do fluxo:**
- `endpoint`, `method` e `headers` são obrigatórios
- A URL é montada como `http://177.38.10.218:8082/datasnap/rest/TSMApi/"<endpoint>"`
- O header `x-promanager-filial` precisa vir preenchido como string
- A resposta é devolvida como JSON quando possível
- Timeout do HTTP Request: `30000` ms

**Importar:** `proxis-proxy.local.json` (arquivo local, não versionado)

**No `.env` da Vercel, certifique-se de que `N8N_WEBHOOK_BASE_URL` está definido:**
```
N8N_WEBHOOK_BASE_URL="https://webhooks-n8n.iainfinity.app/webhook"
```

Com essa env var presente, o código automaticamente roteia as chamadas do Proxis pelo proxy em vez de ir direto no IP interno.

**Observações:**
- O webhook não possui autenticação própria
- A URL base do Proxis está fixa no workflow
- Recomenda-se limitar os endpoints aceitos no chamador

## Testar com CURL (fora do n8n)

1. **Gerar o token Base64** no PowerShell:
```powershell
[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("usuario:senha"))
```

2. **Executar o CURL:**
```powershell
curl.exe -v -X GET "http://177.38.10.218:8082/datasnap/rest/TSMApi/`"ObterItens`"" -H "Content-Type: application/json" -H "Authorization: Basic SEU_TOKEN_AQUI" -H "x-promanager-filial: 5" -H "X-ProManager-Pagina-Inicio: 0" -H "X-ProManager-Pagina-Quant: 10" --connect-timeout 15 --max-time 30
```

- `ECONNREFUSED` = porta fechada ou IP errado (firewall)
- `timeout` = IP existe mas sem resposta
- `200` com JSON = conexão OK
