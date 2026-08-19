# Incidente de segurança — o que fazer

O art. 48 da LGPD obriga a comunicar incidente à ANPD **e aos titulares**. A
Resolução CD/ANPD nº 15/2024 fixou o prazo: **3 dias úteis contados da
confirmação**, peticionado pelo SEI!.

Três dias úteis é pouco. Não dá para descobrir na hora quem decide, quem redige e
quem tem login. Por isso este arquivo existe antes de precisar dele.

---

## ⚠️ Falta preencher

| Papel | Quem | Contato |
|---|---|---|
| Quem confirma que houve incidente | *(a definir)* | |
| Quem comunica à ANPD | *(a definir)* | |
| Quem avisa os titulares | *(a definir)* | |
| Suplente, fora do horário comercial | *(a definir)* | |

**Enquanto esta tabela estiver em branco, o prazo de 3 dias corre sem dono.**
Normalmente é a mesma pessoa do encarregado (art. 41). Precisa ser alguém
alcançável fora do horário comercial — incidente não escolhe o dia.

**Login no SEI! precisa existir e ter sido testado antes.** Descobrir no dia 1
dos 3 que ninguém tem acesso é o pior cenário possível.

---

## O que conta como incidente aqui

Não é toda falha. É o que expõe dado pessoal a quem não deveria vê-lo:

- Vazamento de um export local (`scripts/export-clinic-tables.mjs` despeja
  `customer_profiles` e `orders` em JSON)
- Comprometimento da `SUPABASE_SERVICE_ROLE_KEY`, que ignora toda a RLS
- Falha de RLS que exponha dado entre clientes — já aconteceu duas vezes:
  a tabela de preço (item 3.10) e a autoria das avaliações (item 3.8)
- Acesso indevido de conta administrativa
- Comprometimento do Proxsys ou do Bitrix, que recebem nome, CNPJ, telefone e
  e-mail

Indisponibilidade **não** é incidente de dados. Site fora do ar não comunica nada
à ANPD.

## Os passos

**1. Confirmar.** O relógio dos 3 dias úteis começa aqui, na confirmação — não na
suspeita. Registre data e hora, porque é ela que a ANPD vai perguntar.

**2. Conter.** Rotacionar a chave exposta, revogar a sessão, fechar a policy.
Antes de comunicar, parar a sangria.

**3. Levantar o alcance.** Quantos titulares, quais campos, e desde quando. A
trilha `clinic+b2b_auth_events` ajuda na parte de autenticação; para acesso a
cadastro **não há trilha** — é uma lacuna conhecida, registrada na auditoria.

**4. Comunicar à ANPD.** Pelo SEI!, dentro dos 3 dias úteis. Só o controlador
comunica.

**5. Comunicar os titulares.** O art. 48 exige os dois. Comunicar só a ANPD não
cumpre a obrigação. Modelo abaixo.

**6. Registrar.** O que aconteceu, o que se fez, o que mudou para não repetir.
É o que a ANPD pede depois, e o que evita o mesmo incidente duas vezes.

## Modelo de aviso ao titular

> **Assunto: Comunicado sobre os seus dados**
>
> Identificamos em *(data)* um incidente de segurança que pode ter afetado os
> seus dados cadastrais na Clinic+.
>
> **O que aconteceu:** *(descrição direta, sem jargão)*
> **Quais dados podem ter sido expostos:** *(campos)*
> **O que já fizemos:** *(contenção)*
> **O que recomendamos que você faça:** *(ação, quando houver — trocar senha, por
> exemplo)*
>
> Em caso de dúvida, fale com *(encarregado, contato)*.

## Referência

[Comunicação de incidente — ANPD](https://www.gov.br/anpd/pt-br/assuntos/comunicacao-de-incidentes-de-seguranca-cis)
