/**
 * A ponte entre o campo `datetime-local` e o instante guardado no banco.
 *
 * O campo do navegador nao tem fuso: "2026-08-06T18:55" quer dizer 18:55 no
 * relogio de quem digitou. O banco guarda instante em UTC. Traduzir de um para o
 * outro e obrigatorio nos **dois** sentidos, e faltava a volta.
 *
 * Na gravacao ja havia `new Date(valor).toISOString()`, que esta certo: 18:55 em
 * Brasilia vira `2026-08-06T21:55:00.000Z`. Na leitura o codigo fazia
 * `iso.slice(0, 16)` — recortava `2026-08-06T21:55` e entregava ao campo, que le
 * como hora local. Resultado: quem salvava 18:55 reabria o cadastro e via 21:55.
 * Salvar de novo somava mais tres horas, e a promocao ia andando para a frente a
 * cada edicao.
 *
 * O recorte parecia funcionar porque o formato bate: os 16 primeiros caracteres
 * de um ISO tem exatamente a cara que o campo espera. Sao os numeros que estao
 * errados, nao o formato — por isso nada quebrava, so mentia.
 */

function doisDigitos(valor: number): string {
  return String(valor).padStart(2, "0");
}

/**
 * Instante do banco -> texto do campo, no relogio de quem esta olhando.
 *
 * Monta a partir das partes locais do `Date` (`getFullYear`, `getMonth`, ...),
 * que e o que aplica o fuso. `toISOString().slice(0, 16)` nao serve aqui: ele
 * devolve UTC, que e exatamente o defeito.
 */
export function isoParaCampoLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";

  return (
    `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}` +
    `T${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}`
  );
}

/**
 * Texto do campo -> instante para o banco.
 *
 * `new Date("2026-08-06T18:55")` — sem fuso no texto — e lido como hora local
 * pela especificacao, que e justamente o que o campo quer dizer.
 */
export function campoLocalParaIso(valor: string | null | undefined): string | null {
  const texto = (valor ?? "").trim();
  if (!texto) return null;

  const data = new Date(texto);
  if (Number.isNaN(data.getTime())) return null;

  return data.toISOString();
}
