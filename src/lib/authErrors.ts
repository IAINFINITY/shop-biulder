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

export function translateAuthErrorMessage(message: string, options?: { duplicateEmailText?: string }) {
  const normalized = normalizeAuthMessage(message || "");
  const duplicateEmailText =
    options?.duplicateEmailText || "Este e-mail já está cadastrado. Entre com sua senha ou recupere o acesso.";

  if (!normalized) return "Erro ao autenticar.";

  if (normalized.includes("customer_profiles_cnpj_unique") || (normalized.includes("duplicate") && normalized.includes("cnpj"))) {
    return "Este CNPJ já possui cadastro. Se a empresa já existe, entre com a conta correta ou fale com o suporte.";
  }

  if (normalized.includes("email not confirmed") || normalized.includes("email not verified")) {
    return "Confirme seu e-mail antes de entrar. Verifique a caixa de entrada e o spam.";
  }

  if (
    normalized.includes("invalid login") ||
    normalized.includes("invalid credentials") ||
    normalized.includes("incorrect password") ||
    normalized.includes("senha incorreta")
  ) {
    return "E-mail ou senha incorretos. Confira os dados e tente novamente.";
  }

  if (isRegisteredEmailAuthMessage(normalized)) {
    return duplicateEmailText;
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

  return message;
}
