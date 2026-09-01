import { useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCnpj, formatPhone, onlyDigits } from "@/lib/brazilianIds";
import type { CnpjValidationStatus } from "@/hooks/useCnpjValidation";
import {
  CUSTOMER_TYPES,
  customerTypeLabel,
  DEFAULT_CUSTOMER_TYPE,
  normalizeCustomerType,
} from "@/lib/pricing";
import { Sparkles } from "lucide-react";

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
    docType: "cnpj" | null;
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
  const docLabel = "CNPJ";
  const cnpjDigits = onlyDigits(form.cnpj);
  const shouldLookupCustomer = cnpjValidation.status === "valid";
  /**
   * O preenchimento automático pelo CNPJ saiu em 31/08/2026, com o Proxis.
   *
   * Ele consultava o ERP e oferecia nome e empresa já cadastrados. Sem ERP não
   * há de onde tirar — quem compra digita, como já digitava quando o CNPJ era
   * novo. A validação do CNPJ continua, pela Receita.
   */
  const autoAppliedCnpjRef = useRef<string | null>(null);

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
          onChange={(e) => onChange({ phone: formatPhone(onlyDigits(e.target.value)) })}
          placeholder="(00) 00000-0000"
          inputMode="numeric"
          type="tel"
          maxLength={15}
          required
          autoComplete="tel"
          onKeyDown={(e) => {
            const allowedKeys = [
              "Backspace",
              "Delete",
              "Tab",
              "ArrowLeft",
              "ArrowRight",
              "Home",
              "End",
              "Enter",
            ];
            if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;
            if (!/^\d$/.test(e.key)) {
              e.preventDefault();
            }
          }}
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
        <Label htmlFor={id("cnpj")}>CNPJ</Label>
        <p className="text-xs leading-5 text-muted-foreground">
          Informe o CNPJ da empresa para identificar a tabela de preços. Se estiver cadastrado, sugerimos nome e empresa automaticamente.
        </p>
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
            (cnpjValidation.isDocIncomplete ||
              cnpjValidation.isDocInvalid ||
              cnpjValidation.isDocError)
          }
          className={
            show &&
            (cnpjValidation.isDocIncomplete ||
              cnpjValidation.isDocInvalid ||
              cnpjValidation.isDocError)
              ? "border-destructive focus-visible:ring-destructive"
              : undefined
          }
          required
        />

        {show && cnpjValidation.isDocIncomplete && (
          <p className="text-xs text-destructive">
            CNPJ incompleto. Preencha 14 dígitos.
          </p>
        )}
        {show && cnpjValidation.isDocInvalid && (
          <p className="text-xs text-destructive">CNPJ inválido. Verifique o número informado.</p>
        )}
        {/* Sem vermelho, e sem "tente novamente": a consulta à Receita é
            conveniência, não autorização, e desde 19/08/2026 a falha dela não
            barra o pedido. Pintar de erro o que não impede nada faz a pessoa
            parar e procurar o que consertar. */}
        {show && cnpjValidation.isDocError && (
          <p className="text-xs text-muted-foreground">
            Não foi possível consultar a Receita agora. Você pode seguir; confira se os dados da empresa estão certos.
          </p>
        )}
        {show && cnpjValidation.isDocChecking && (
          <p className="text-xs text-muted-foreground">Validando documento...</p>
        )}

      </div>
    </>
  );
}
