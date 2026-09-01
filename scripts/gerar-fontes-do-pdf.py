"""
Gera as fontes que o PDF do pedido embute.

## Por que este script existe

O PDF saía em Helvetica — uma das 14 fontes que todo leitor de PDF tem, e que
por isso **não é embutida**: cada leitor substitui pela que tiver à mão. O
resultado é um documento que muda de cara conforme quem abre, e a versão que
sai no Windows não é a que se aprovou. Num formato cujo propósito é travar o
layout, deixar a fonte solta é contradizer o formato.

A fonte da marca é a Inter — a mesma do painel (`tailwind.config.ts`). Ela já
está no projeto via `@fontsource-variable/inter`, mas em **woff2**, que o jsPDF
não lê. Este script faz a ponte:

  1. abre a variável e a instancia em dois pesos fixos (400 e 600);
  2. corta tudo que o PDF não usa (subset por caractere);
  3. grava em TTF cru e emite o base64 num módulo TypeScript.

O subset é o que torna isso barato: a Inter completa passa de 300 KB por peso;
recortada para o latim mais a pontuação que o documento usa, cada peso fica em
~23 KB. E o módulo é carregado sob demanda (`await import`), então não pesa em
quem nunca baixa um PDF.

## Quando rodar de novo

Só se a fonte da marca mudar, ou se o documento precisar de um alfabeto fora
das faixas abaixo. O resultado é determinístico.

    pip install fonttools brotli
    python scripts/gerar-fontes-do-pdf.py
"""

import base64
import io
import os

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ORIGEM = "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"
DESTINO = "src/assets/fontes/interParaPdf.ts"

# ⚠️ **Faixas Unicode, e não uma lista escrita à mão.**
#
# A primeira versão listava os caracteres um a um. Faltou o `U+00A0` — o espaço
# inquebrável que o `Intl.NumberFormat` põe entre "R$" e o número — e o efeito
# não foi um quadradinho vazio: o jsPDF **cortou o resto da string**. Todos os
# valores do PDF saíram como "R$" sozinho, e a tabela inteira ficou sem preço.
#
# Uma lista à mão é uma aposta de que ninguém vai digitar um caractere que não
# se previu, num campo livre (nome de produto, endereço, observação do cliente).
# É uma aposta que se perde em silêncio. As faixas cobrem o que qualquer texto
# em português — e na maior parte das línguas europeias — pode conter.
FAIXAS = [
    (0x0020, 0x007E),  # ASCII imprimível
    (0x00A0, 0x00FF),  # Latin-1 Supplement: acentuadas, º ª °, e o NBSP
    (0x0100, 0x017F),  # Latin Extended-A
    (0x2010, 0x2027),  # travessões, aspas curvas, reticências, meio-de-linha
    (0x20A0, 0x20BF),  # símbolos de moeda (₢, €, ₽…)
    (0x2122, 0x2122),  # ™
    (0x00AE, 0x00AE),  # ® (já dentro do Latin-1, explícito por ser comum)
]

UNICODES = [c for inicio, fim in FAIXAS for c in range(inicio, fim + 1)]

PESOS = [(400, "REGULAR", "normal"), (600, "SEMIBOLD", "bold")]


def gerar(peso: int) -> bytes:
    fonte = TTFont(ORIGEM)
    instantiateVariableFont(fonte, {"wght": peso}, inplace=True, updateFontNames=True)

    opcoes = subset.Options()
    # `kern` e `liga`: sem elas o texto perde o espacejamento que faz a Inter
    # parecer Inter, e o ganho de tamanho é irrisório.
    opcoes.layout_features = ["kern", "liga"]
    opcoes.drop_tables += ["DSIG"]
    opcoes.notdef_outline = True

    cortador = subset.Subsetter(options=opcoes)
    cortador.populate(unicodes=UNICODES)
    cortador.subset(fonte)

    buffer = io.BytesIO()
    fonte.flavor = None  # TTF cru: é o que o jsPDF aceita
    fonte.save(buffer)
    return buffer.getvalue()


def main() -> None:
    partes = [
        "// GERADO POR scripts/gerar-fontes-do-pdf.py — NÃO EDITE À MÃO.",
        "//",
        "// A Inter da marca, instanciada em dois pesos e recortada para os",
        "// caracteres que o PDF do pedido usa. Ver o cabeçalho do script para o",
        "// porquê de embutir em vez de usar a Helvetica padrão do PDF.",
        "",
    ]

    for peso, constante, estilo in PESOS:
        dados = gerar(peso)
        b64 = base64.b64encode(dados).decode("ascii")
        partes.append(f"/** Inter {peso} — estilo `{estilo}` no jsPDF. {len(dados) // 1024} KB. */")
        partes.append(f'export const INTER_{constante} =\n  "{b64}";')
        partes.append("")
        print(f"Inter {peso}: {len(dados) / 1024:.0f} KB")

    os.makedirs(os.path.dirname(DESTINO), exist_ok=True)
    with open(DESTINO, "w", encoding="utf-8", newline="\n") as arquivo:
        arquivo.write("\n".join(partes))

    print(f"escrito em {DESTINO}")


if __name__ == "__main__":
    main()
