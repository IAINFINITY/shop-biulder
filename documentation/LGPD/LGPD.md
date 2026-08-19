# LGPD — índice

O que temos anotado sobre proteção de dados, e onde está o original de cada coisa.

## Nesta pasta

| Arquivo | O que é |
|---|---|
| [lei-13709-2018-lgpd.md](lei-13709-2018-lgpd.md) | Texto integral da Lei nº 13.709/2018, em vigor, copiado do Planalto em 19/08/2026. É a cópia de consulta — para citar artigo sem depender do site fora do ar |
| [AUDITORIA-LGPD.md](AUDITORIA-LGPD.md) | O projeto lido contra a lei em 19/08/2026: o que está certo, o que falta, o que está errado, e o que depende de decisão de negócio |
| [RETENCAO.md](RETENCAO.md) | Prazo de guarda por tabela, de onde vem cada prazo, e o expurgo diário que os cumpre |
| [INCIDENTE.md](INCIDENTE.md) | O que fazer nos 3 dias úteis do art. 48. **Falta preencher quem é responsável** |
| [GUIA-DO-ATENDIMENTO.md](GUIA-DO-ATENDIMENTO.md) | Uma página para quem atende: reconhecer pedido de titular e o prazo que ele dispara |
| [REGISTRO-DE-TRATAMENTO.md](REGISTRO-DE-TRATAMENTO.md) | O registro do art. 37: as nove operações, com finalidade, base legal, retenção e compartilhamento |
| [AVISO-DE-PRIVACIDADE-RASCUNHO.md](AVISO-DE-PRIVACIDADE-RASCUNHO.md) | O texto pronto para revisão jurídica. **Falta o nome do encarregado** |
| [OPERADORES.md](OPERADORES.md) | Com quem os dados são compartilhados, onde cada um processa, e o estado dos contratos |
| [../planejamento/PLANO_LGPD.MD](../planejamento/PLANO_LGPD.MD) | Os achados da auditoria virados em trabalho: seis frentes, o que trava o quê, e a ordem de execução |

## Fontes oficiais

**A lei**

- [Lei nº 13.709/2018 — texto compilado (Planalto)](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) — **o original.** Mostra as redações revogadas tachadas, que a cópia local não traz
- [Lei nº 13.853/2019](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2019/lei/l13853.htm) — criou a ANPD e reescreveu boa parte do texto
- [Lei nº 14.460/2022](https://www.planalto.gov.br/ccivil_03/_ato2019-2022/2022/lei/l14460.htm) — transformou a ANPD em autarquia de natureza especial
- [Lei nº 15.352/2026](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15352.htm) e [Lei nº 15.452/2026](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2026/lei/l15452.htm) — alterações mais recentes
- [Lei nº 12.965/2014 — Marco Civil da Internet](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm) — alterada pelo art. 60 da LGPD

**O regulador**

- [ANPD](https://www.gov.br/anpd/pt-br) — Agência Nacional de Proteção de Dados. É quem fiscaliza, edita regulamento e aplica sanção
- [Documentos técnicos e orientativos](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/documentos-tecnicos-orientativos) — os guias que valem ler: anonimização, hipóteses legais para dados de crianças e adolescentes, notas técnicas
- [Comunicação de incidente de segurança](https://www.gov.br/anpd/pt-br/assuntos/comunicacao-de-incidentes-de-seguranca-cis) — o procedimento, o prazo e o peticionamento pelo SEI!. **Só o controlador comunica**
- [Regulação](https://www.gov.br/anpd/pt-br/assuntos/regulacao) — como a ANPD produz norma. As resoluções em si ficam nas deliberações do Conselho Diretor
- [Titular de dados](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1) e [denúncia de descumprimento](https://www.gov.br/anpd/pt-br/assuntos/denuncia-de-descumprimento-da-lgpd) — o outro lado do balcão: por onde um cliente nosso reclamaria

## Os artigos que mais pesam para um e-commerce B2B

Atalho de leitura, não substituto do texto:

| Assunto | Onde |
|---|---|
| Definições (dado pessoal, sensível, controlador, operador, encarregado) | art. 5º |
| Princípios (finalidade, necessidade, transparência, segurança) | art. 6º |
| Bases legais para tratar dado comum | art. 7º |
| Dado sensível — regra mais estreita | art. 11 |
| Direitos do titular (acesso, correção, eliminação, portabilidade) | art. 18 |
| Prazo de resposta ao titular | art. 19 |
| Término do tratamento e eliminação | arts. 15 e 16 |
| Segurança, incidente e comunicação à ANPD | arts. 46 a 48 |
| Encarregado (DPO) — indicação e identidade pública | art. 41 |
| Registro das operações de tratamento | art. 37 |
| Sanções administrativas (até 2% do faturamento, teto de R$ 50 milhões) | arts. 52 a 54 |
| Transferência internacional | arts. 33 a 36 |

## Prazos que valem lembrar

- Vigência: 24 meses após a publicação para o corpo da lei — data usualmente citada, **18/09/2020**; sanções administrativas desde **01/08/2021** (art. 65)
- Resposta ao titular: **imediata** para confirmação simplificada, **15 dias** para a declaração completa (art. 19)
- Incidente de segurança: **3 dias úteis** contados da confirmação, pela [Resolução CD/ANPD nº 15/2024](https://www.gov.br/anpd/pt-br/assuntos/comunicacao-de-incidentes-de-seguranca-cis). O art. 48 fala em "prazo razoável" — quem fixou os 3 dias foi a resolução
- Comunicar à ANPD **não basta**: o art. 48 também exige avisar os titulares afetados
