export const onlyDigits = (value: string) => value.replace(/\D/g, "");

export const formatCnpj = (value: string) => {
  const digits = onlyDigits(value).slice(0, 14);
  const part1 = digits.slice(0, 2);
  const part2 = digits.slice(2, 5);
  const part3 = digits.slice(5, 8);
  const part4 = digits.slice(8, 12);
  const part5 = digits.slice(12, 14);
  let formatted = part1;
  if (part2) formatted += `.${part2}`;
  if (part3) formatted += `.${part3}`;
  if (part4) formatted += `/${part4}`;
  if (part5) formatted += `-${part5}`;
  return formatted;
};

export const formatPhone = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);
  if (!digits) return "";
  if (digits.length <= 2) return digits;
  const ddd = digits.slice(0, 2);
  const isMobile = digits.length > 10;
  const part1 = digits.slice(2, isMobile ? 7 : 6);
  const part2 = digits.slice(isMobile ? 7 : 6);
  let formatted = `(${ddd})`;
  if (part1) formatted += ` ${part1}`;
  if (part2) formatted += `-${part2}`;
  return formatted;
};

export const isValidCnpj = (value: string) => {
  const digits = onlyDigits(value);
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false;

  const calcCheckDigit = (base: string, weights: number[]) => {
    const sum = base
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const digit1 = calcCheckDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const digit2 = calcCheckDigit(`${digits.slice(0, 12)}${digit1}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits.endsWith(`${digit1}${digit2}`);
};

export const formatCpf = (value: string) => {
  const digits = onlyDigits(value).slice(0, 11);
  const part1 = digits.slice(0, 3);
  const part2 = digits.slice(3, 6);
  const part3 = digits.slice(6, 9);
  const part4 = digits.slice(9, 11);
  let formatted = part1;
  if (part2) formatted += `.${part2}`;
  if (part3) formatted += `.${part3}`;
  if (part4) formatted += `-${part4}`;
  return formatted;
};

export const isValidCpf = (value: string) => {
  const digits = onlyDigits(value);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcCheckDigit = (base: string, weights: number[]) => {
    const sum = base
      .split("")
      .reduce((total, digit, index) => total + Number(digit) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const digit1 = calcCheckDigit(digits.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const digit2 = calcCheckDigit(`${digits.slice(0, 9)}${digit1}`, [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits.endsWith(`${digit1}${digit2}`);
};

export const formatDocumentId = (value: string) => {
  const digits = onlyDigits(value);
  if (digits.length <= 11) return formatCpf(digits);
  return formatCnpj(digits);
};

export const formatCnpjDisplay = (digitsOrFormatted: string) => {
  const digits = onlyDigits(digitsOrFormatted);
  if (digits.length !== 14) return digitsOrFormatted;
  return formatCnpj(digits);
};
