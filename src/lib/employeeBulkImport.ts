/**
 * Leitura do TXT de importacao de funcionarios.
 *
 * Os campos sao os mesmos que o cadastro um a um exige — nome, e-mail, telefone
 * e CPF. A senha fica de fora do arquivo de proposito: senha em arquivo de texto
 * circula por e-mail e por chat, e quem monta a lista costuma ser quem menos
 * deveria escolher a senha dos outros. Todo mundo entra com a mesma senha
 * provisoria e troca no primeiro acesso.
 */

/** Senha provisoria. Atende as regras do cadastro: maiuscula, minuscula, numero e simbolo. */
/**
 * @deprecated A senha provisoria vive em `clinic+b2b_config_seguranca` no banco,
 * lida pela funcao de borda `create-employee-user`. Este valor ficou apenas como
 * texto de apoio ao admin e **nao e mais usado para criar ninguem** — mudar aqui
 * nao muda a senha de nada.
 *
 * Para alterar a senha provisoria de verdade, mude a linha
 * `senha_padrao_funcionario` naquela tabela.
 */
export const SENHA_PADRAO_EXIBIDA = "a senha provisória configurada";

export const COLUNAS_TXT = ["nome", "email", "telefone", "cpf"] as const;

export type LinhaImportacao = {
  /** Numero da linha no arquivo, contando as ignoradas — e o que a pessoa ve no editor. */
  linha: number;
  nome: string;
  email: string;
  telefone: string;
  cpf: string;
};

export type ErroImportacao = {
  linha: number;
  conteudo: string;
  motivo: string;
};

export type ResultadoLeitura = {
  validos: LinhaImportacao[];
  erros: ErroImportacao[];
  /** Linhas em branco, comentario ou cabecalho. Nao sao erro. */
  ignoradas: number;
};

/** O que ja existe cadastrado, para barrar repetido antes de enviar. */
export type CadastroExistente = { email?: string | null; cpf?: string | null };

export function apenasDigitos(valor: string): string {
  return valor.replace(/\D+/g, "");
}

/**
 * Separador da linha.
 *
 * Virgula e o combinado, mas planilha brasileira exporta com ponto e virgula, e
 * quem cola de uma tabela traz tabulacao. Recusar essas duas faria a pessoa
 * culpar o arquivo inteiro por um caractere.
 */
function separar(linha: string): string[] {
  const separador = linha.includes(";") ? ";" : linha.includes("\t") ? "\t" : ",";
  return linha.split(separador).map((campo) => campo.trim());
}

function pareceCabecalho(campos: string[]): boolean {
  const primeiro = campos[0]?.toLowerCase() ?? "";
  return primeiro === "nome" || primeiro === "usuario" || primeiro === "usuário";
}

function emailValido(email: string): boolean {
  // Deliberadamente frouxo: a validacao de verdade e o e-mail chegar. Regex
  // rigorosa demais rejeita endereco valido e trava a importacao inteira.
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/**
 * Le o TXT e recusa quem ja esta cadastrado.
 *
 * O banco tambem barra — o e-mail pelo Auth, o CPF pelo indice unico
 * `customer_profiles_cnpj_unique` — mas so na hora de criar, um por vez. Num
 * arquivo de 50 linhas com 10 pessoas ja cadastradas, sem esta checagem seriam
 * 10 idas ao servidor para descobrir o que ja se sabia antes de comecar, e a
 * pessoa veria dez mensagens de erro do Postgres no meio da importacao.
 */
export function lerTxtDeFuncionarios(
  conteudo: string,
  jaCadastrados: readonly CadastroExistente[] = [],
): ResultadoLeitura {
  const emailsExistentes = new Set(
    jaCadastrados.map((c) => c.email?.trim().toLowerCase()).filter((e): e is string => Boolean(e)),
  );
  const cpfsExistentes = new Set(
    jaCadastrados.map((c) => apenasDigitos(c.cpf ?? "")).filter((c) => c.length === 11),
  );

  const validos: LinhaImportacao[] = [];
  const erros: ErroImportacao[] = [];
  let ignoradas = 0;

  const emailsVistos = new Map<string, number>();
  const cpfsVistos = new Map<string, number>();

  conteudo.split(/\r?\n/).forEach((bruta, indice) => {
    const linha = indice + 1;
    const texto = bruta.trim();

    if (!texto || texto.startsWith("#")) {
      ignoradas += 1;
      return;
    }

    const campos = separar(texto);

    if (linha === 1 && pareceCabecalho(campos)) {
      ignoradas += 1;
      return;
    }

    if (campos.length < COLUNAS_TXT.length) {
      erros.push({
        linha,
        conteudo: texto,
        motivo: `Esperado ${COLUNAS_TXT.length} campos (${COLUNAS_TXT.join(", ")}), veio ${campos.length}.`,
      });
      return;
    }

    const [nome, email, telefone, cpf] = campos;
    const cpfDigitos = apenasDigitos(cpf);
    const telefoneDigitos = apenasDigitos(telefone);
    const emailNormalizado = email.toLowerCase();

    if (!nome) {
      erros.push({ linha, conteudo: texto, motivo: "Nome vazio." });
      return;
    }
    if (!emailValido(emailNormalizado)) {
      erros.push({ linha, conteudo: texto, motivo: `E-mail inválido: "${email}".` });
      return;
    }
    if (telefoneDigitos.length < 10 || telefoneDigitos.length > 11) {
      erros.push({
        linha,
        conteudo: texto,
        motivo: `Telefone precisa de 10 ou 11 dígitos com DDD, veio ${telefoneDigitos.length}.`,
      });
      return;
    }
    if (cpfDigitos.length !== 11) {
      erros.push({ linha, conteudo: texto, motivo: `CPF precisa de 11 dígitos, veio ${cpfDigitos.length}.` });
      return;
    }

    // Repetido dentro do proprio arquivo. Sem esta checagem a segunda linha so
    // falharia no servidor, no meio da importacao, com metade ja criada.
    const emailAnterior = emailsVistos.get(emailNormalizado);
    if (emailAnterior) {
      erros.push({ linha, conteudo: texto, motivo: `E-mail repetido — já aparece na linha ${emailAnterior}.` });
      return;
    }
    const cpfAnterior = cpfsVistos.get(cpfDigitos);
    if (cpfAnterior) {
      erros.push({ linha, conteudo: texto, motivo: `CPF repetido — já aparece na linha ${cpfAnterior}.` });
      return;
    }

    if (emailsExistentes.has(emailNormalizado)) {
      erros.push({ linha, conteudo: texto, motivo: `E-mail já cadastrado: ${emailNormalizado}.` });
      return;
    }
    if (cpfsExistentes.has(cpfDigitos)) {
      erros.push({ linha, conteudo: texto, motivo: `CPF já cadastrado para outro funcionário.` });
      return;
    }

    emailsVistos.set(emailNormalizado, linha);
    cpfsVistos.set(cpfDigitos, linha);

    validos.push({ linha, nome, email: emailNormalizado, telefone: telefoneDigitos, cpf: cpfDigitos });
  });

  return { validos, erros, ignoradas };
}

/** Modelo para o botao "baixar exemplo". */
export const EXEMPLO_TXT = [
  "# nome,email,telefone,cpf",
  "# Todos entram com a senha provisória e devem trocá-la no primeiro acesso.",
  "Maria Souza,maria.souza@empresa.com.br,11987654321,12345678901",
  "João Lima,joao.lima@empresa.com.br,(11) 91234-5678,987.654.321-00",
].join("\n");
