export function normalizeAuthMessage(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isRegisteredEmailAuthMessage(message: string) {
  const normalized = normalizeAuthMessage(message);
  return (
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("user already exists") ||
    normalized.includes("email already exists") ||
    normalized.includes("email exists") ||
    normalized.includes("ja esta cadastrado")
  );
}

/**
 * Mensagem de erro de autenticacao, sem contar quem existe.
 *
 * A §21 do padrao exige comportamento **observavel equivalente** para conta
 * inexistente, senha incorreta, conta suspensa, recuperacao de conta inexistente
 * e cadastro com identificador existente. Mensagem diferente e diferenca
 * observavel — bastava um formulario e uma lista de e-mails para levantar quem e
 * cliente da Clinic+.
 *
 * O parametro `duplicateEmailText` continua na assinatura para nao quebrar quem
 * chama, mas **e ignorado**: nao ha texto de "ja cadastrado" que seja seguro.
 */
export function translateAuthErrorMessage(message: string, _options?: { duplicateEmailText?: string }) {
  const normalized = normalizeAuthMessage(message || "");

  if (!normalized) return "Erro ao autenticar.";

  // CNPJ e diferente de e-mail: quem digita um CNPJ ja e a empresa dona dele, e a
  // informacao nao serve para varrer terceiros. Fica.
  if (normalized.includes("customer_profiles_cnpj_unique") || (normalized.includes("duplicate") && normalized.includes("cnpj"))) {
    return "Este CNPJ já possui cadastro. Se a empresa já existe, entre com a conta correta ou fale com o suporte.";
  }

  // As tres condicoes abaixo cabiam em ramos distintos e cada texto denunciava um
  // estado: "nao confirmado" e "ja cadastrado" provam que a conta existe;
  // "credencial invalida" nao prova nada. Agora as tres respondem igual.
  if (
    normalized.includes("invalid login") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("incorrect password") ||
    normalized.includes("senha incorreta") ||
    normalized.includes("email not confirmed") ||
    normalized.includes("email not verified") ||
    isRegisteredEmailAuthMessage(normalized)
  ) {
    return "E-mail ou senha incorretos. Confira os dados e tente novamente.";
  }

  if (normalized.includes("invalid email")) {
    return "O e-mail informado não parece válido. Revise o endereço antes de continuar.";
  }

  if (normalized.includes("password") && (normalized.includes("weak") || normalized.includes("short"))) {
    return "A senha informada não atende aos requisitos de segurança.";
  }

  if (normalized.includes("rate limit") || normalized.includes("too many requests")) {
    return "Muitas tentativas em sequência. Aguarde alguns instantes e tente novamente.";
  }

  // Mensagem crua do provedor pode descrever estado interno da conta.
  console.warn("[auth] mensagem sem tradução:", message);
  return "Não foi possível concluir. Verifique os dados e tente de novo.";
}
