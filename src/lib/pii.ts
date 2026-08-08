// Mascaramento de dado pessoal antes de ir para log.
//
// O log de producao da Vercel e lido por mais gente do que o banco, fica retido
// por semanas e sai da nossa fronteira de controle. CNPJ de cliente ali dentro e
// dado cadastral em claro, sem nenhum ganho de diagnostico — o que se precisa
// saber, olhando um log, e *qual* pedido, nao *de quem*.
//
// Sem rede e sem `process.env`: e importado tanto pelas rotas em `api/` quanto
// pelo bundle do navegador.

/**
 * CNPJ com apenas os quatro ultimos digitos visiveis: `********0106`.
 *
 * Quatro digitos bastam para casar duas linhas do mesmo log entre si, que e o
 * uso real, e nao bastam para identificar a empresa.
 *
 * Valor que nao tem 14 digitos vira `<cnpj invalido>`: devolver a entrada crua
 * seria justamente vazar o que a funcao existe para esconder.
 */
export function mascararCnpj(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length !== 14) return "<cnpj invalido>";
  return `${"*".repeat(10)}${digits.slice(-4)}`;
}
