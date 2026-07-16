import { useEffect, useRef } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDocumentId, formatPhone, onlyDigits } from "@/lib/brazilianIds";
import type { CnpjValidationStatus } from "@/hooks/useCnpjValidation";
import { useCnpjCustomerLookup } from "@/hooks/useCnpjCustomerLookup";
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
  const { status: cnpjLookupStatus, suggestion } = useCnpjCustomerLookup(form.cnpj, shouldLookupCustomer);
  const autoAppliedCnpjRef = useRef<string | null>(null);

  const suggestionMatchesForm =
    !suggestion ||
    (form.name.trim() === suggestion.name.trim() && form.company.trim() === suggestion.company.trim());
  const showSuggestionCard = shouldLookupCustomer && suggestion && !suggestionMatchesForm;

  useEffect(() => {
    if (!shouldLookupCustomer || !suggestion) return;
    if (autoAppliedCnpjRef.current === cnpjDigits) return;

    const patch: Partial<CustomerFormData> = {};
    if (!form.name.trim() && suggestion.name) {
      patch.name = suggestion.name;
    }
    if (!form.company.trim() && suggestion.company) {
      patch.company = suggestion.company;
    }

    if (Object.keys(patch).length > 0) {
      onChange(patch);
      autoAppliedCnpjRef.current = cnpjDigits;
    }
  }, [cnpjDigits, form.company, form.name, onChange, shouldLookupCustomer, suggestion]);

  const handleApplyLookupSuggestion = () => {
    if (!suggestion) return;
    autoAppliedCnpjRef.current = cnpjDigits;
    onChange({
      name: suggestion.name || form.name,
      company: suggestion.company || form.company,
    });
  };

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
          onChange={(e) => onChange({ cnpj: formatDocumentId(e.target.value) })}
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
        {show && cnpjValidation.isDocError && (
          <p className="text-xs text-destructive">
            Não foi possível validar o documento agora. Tente novamente.
          </p>
        )}
        {show && cnpjValidation.isDocChecking && (
          <p className="text-xs text-muted-foreground">Validando documento...</p>
        )}

        {cnpjLookupStatus === "loading" ? (
          <p className="text-xs text-muted-foreground">Consultando dados do CNPJ...</p>
        ) : null}

        {cnpjLookupStatus === "not_found" && cnpjDigits.length === 14 ? (
          <p className="text-xs text-muted-foreground">
            Não encontramos dados automáticos para este CNPJ. Você pode preencher tudo manualmente.
          </p>
        ) : null}

        {showSuggestionCard ? (
          <div className="mt-3 rounded-[1.25rem] border border-primary/15 bg-primary/5 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-primary">Dados encontrados para este CNPJ</p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Nome: <span className="font-medium text-foreground">{suggestion.name}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Empresa: <span className="font-medium text-foreground">{suggestion.company}</span>
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Você pode usar esses dados agora ou editar tudo manualmente nos campos acima.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-full border-primary/30 px-4 text-sm"
                onClick={handleApplyLookupSuggestion}
              >
                Usar dados do CNPJ
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
