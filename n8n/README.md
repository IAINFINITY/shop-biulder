# Teste Proxis no n8n — ObterItens

## Importar o workflow

1. No n8n: **Workflows** → **Import from File**
2. Selecione `proxis-obter-itens.json`
3. Abra o nó **Config Proxis** e preencha:
   - `proxis_user` — mesmo do `.env` (`PROXSIS_USER`)
   - `proxis_password` — mesmo do `.env` (`PROXSIS_PASSWORD`)
   - `proxis_filial` — normalmente `5`
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
