import fs from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Resolve import de `.js` para o `.ts` correspondente.
 *
 * As rotas em `api/` importam codigo de `src/lib` com extensao `.js` — e o que a
 * Vercel exige, porque la o TypeScript ja foi compilado. Localmente o arquivo
 * `.js` nao existe: so ha o `.ts`. O Node entao aborta com ERR_MODULE_NOT_FOUND
 * ao carregar o handler, e como o servidor monta todas as rotas de uma vez,
 * **nenhuma** rota sobe — todas respondem "Not found", inclusive as que nao
 * dependem do arquivo faltante.
 *
 * O gancho so entra em acao quando o `.js` realmente nao existe e ha um `.ts` no
 * lugar, entao nao interfere em dependencia publicada.
 */
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND" || !specifier.endsWith(".js")) throw error;

    const asTypeScript = specifier.replace(/\.js$/, ".ts");
    const resolved = await nextResolve(asTypeScript, context).catch(() => null);
    if (!resolved) throw error;

    const filePath = fileURLToPath(resolved.url);
    if (!fs.existsSync(filePath)) throw error;

    return resolved;
  }
}
