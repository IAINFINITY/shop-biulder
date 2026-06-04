import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCnpj, formatPhone } from "@/lib/brazilianIds";
import type { CnpjValidationStatus } from "@/hooks/useCnpjValidation";

export type CustomerFormData = {
  name: string;
  phone: string;
  company: string;
  cnpj: string;
};

type CustomerDataFieldsProps = {
  form: CustomerFormData;
  onChange: (patch: Partial<CustomerFormData>) => void;
  onCnpjBlur?: () => void;
  cnpjValidation?: {
    shouldShowCnpjError: boolean;
    isCnpjIncomplete: boolean;
    isCnpjInvalid: boolean;
    isCnpjError: boolean;
    isCnpjChecking: boolean;
    status: CnpjValidationStatus;
  };
  idPrefix?: string;
};

export function CustomerDataFields({
  form,
  onChange,
  onCnpjBlur,
  cnpjValidation,
  idPrefix = "",
}: CustomerDataFieldsProps) {
  const id = (field: string) => (idPrefix ? `${idPrefix}-${field}` : field);
  const show = cnpjValidation?.shouldShowCnpjError ?? false;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={id("name")}>Nome</Label>
        <Input
          id={id("name")}
          value={form.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Nome completo"
          required
          autoComplete="name"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("phone")}>Telefone</Label>
        <Input
          id={id("phone")}
          value={form.phone}
          onChange={(e) => onChange({ phone: formatPhone(e.target.value) })}
          placeholder="(00) 00000-0000"
          inputMode="numeric"
          maxLength={15}
          required
          autoComplete="tel"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("company")}>Empresa</Label>
        <Input
          id={id("company")}
          value={form.company}
          onChange={(e) => onChange({ company: e.target.value })}
          placeholder="Nome da empresa"
          required
          autoComplete="organization"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("cnpj")}>CNPJ</Label>
        <Input
          id={id("cnpj")}
          value={form.cnpj}
          onChange={(e) => onChange({ cnpj: formatCnpj(e.target.value) })}
          onBlur={onCnpjBlur}
          placeholder="00.000.000/0000-00"
          inputMode="numeric"
          maxLength={18}
          aria-invalid={
            show &&
            (cnpjValidation?.isCnpjIncomplete ||
              cnpjValidation?.isCnpjInvalid ||
              cnpjValidation?.isCnpjError)
          }
          className={
            show &&
            (cnpjValidation?.isCnpjIncomplete ||
              cnpjValidation?.isCnpjInvalid ||
              cnpjValidation?.isCnpjError)
              ? "border-destructive focus-visible:ring-destructive"
              : undefined
          }
          required
        />

        {show && cnpjValidation?.isCnpjIncomplete && (
          <p className="text-xs text-destructive">CNPJ incompleto. Preencha 14 digitos.</p>
        )}
        {show && cnpjValidation?.isCnpjInvalid && (
          <p className="text-xs text-destructive">CNPJ invalido. Verifique o numero informado.</p>
        )}
        {show && cnpjValidation?.isCnpjError && (
          <p className="text-xs text-destructive">
            Nao foi possivel validar o CNPJ agora. Tente novamente.
          </p>
        )}
        {show && cnpjValidation?.isCnpjChecking && (
          <p className="text-xs text-muted-foreground">Validando CNPJ...</p>
        )}
      </div>
    </>
  );
}
