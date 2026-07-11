import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDocumentId, formatPhone } from "@/lib/brazilianIds";
import type { CnpjValidationStatus } from "@/hooks/useCnpjValidation";
import {
  CUSTOMER_TYPE_LABELS,
  CUSTOMER_TYPES,
  customerTypeLabel,
  DEFAULT_CUSTOMER_TYPE,
  normalizeCustomerType,
} from "@/lib/pricing";

export type CustomerFormData = {
  name: string;
  phone: string;
  company: string;
  cnpj: string;
  customer_type: string;
};

type CustomerDataFieldsProps = {
  form: CustomerFormData;
  onChange: (patch: Partial<CustomerFormData>) => void;
  onCnpjBlur: () => void;
  cnpjValidation: {
    shouldShowError: boolean;
    isDocIncomplete: boolean;
    isDocInvalid: boolean;
    isDocError: boolean;
    isDocChecking: boolean;
    docType: "cpf" | "cnpj" | null;
    status: CnpjValidationStatus;
  };
  idPrefix?: string;
  showCustomerType?: boolean;
};

export function CustomerDataFields({
  form,
  onChange,
  onCnpjBlur,
  cnpjValidation,
  idPrefix = "",
  showCustomerType = false,
}: CustomerDataFieldsProps) {
  const id = (field: string) => (idPrefix ? `${idPrefix}-${field}` : field);
  const show = cnpjValidation.shouldShowError ?? false;
  const customerType = normalizeCustomerType(form.customer_type ?? DEFAULT_CUSTOMER_TYPE);
  const docLabel = cnpjValidation.docType === "cnpj" ? "CNPJ" : "CPF";

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

      {showCustomerType && (
        <div className="space-y-2">
          <Label htmlFor={id("customer_type")}>Tipo de cliente</Label>
          <Select
            value={customerType}
            onValueChange={(value) => onChange({ customer_type: normalizeCustomerType(value) })}
          >
            <SelectTrigger id={id("customer_type")}>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMER_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {customerTypeLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Esse campo define a tabela de preço aplicada ao cliente.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor={id("cnpj")}>CPF / CNPJ</Label>
        <Input
          id={id("cnpj")}
          value={form.cnpj}
          onChange={(e) => onChange({ cnpj: formatDocumentId(e.target.value) })}
          onBlur={onCnpjBlur}
          placeholder="000.000.000-00 ou 00.000.000/0000-00"
          inputMode="numeric"
          maxLength={18}
          aria-invalid={
            show &&
            (cnpjValidation.isDocIncomplete ||
              cnpjValidation.isDocInvalid ||
              cnpjValidation.isDocError)
          }
          className={
            show &&
            (cnpjValidation.isDocIncomplete ||
              cnpjValidation.isDocInvalid ||
              cnpjValidation.isDocError) ? "border-destructive focus-visible:ring-destructive"
              : undefined
          }
          required
        />

        {show && cnpjValidation.isDocIncomplete && (
          <p className="text-xs text-destructive">{docLabel} incompleto. Preencha {cnpjValidation.docType === "cnpj" ? "14" : "11"} dígitos.</p>
        )}
        {show && cnpjValidation.isDocInvalid && (
          <p className="text-xs text-destructive">{docLabel} inválido. Verifique o número informado.</p>
        )}
        {show && cnpjValidation.isDocError && (
          <p className="text-xs text-destructive">
            Não foi possível validar o documento agora. Tente novamente.
          </p>
        )}
        {show && cnpjValidation.isDocChecking && (
          <p className="text-xs text-muted-foreground">Validando documento...</p>
        )}
      </div>
    </>
  );
}
