import { useCallback, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCep, type AddressFormData } from "@/lib/address";
import { useCepLookup } from "@/hooks/useCepLookup";

type AddressFieldsProps = {
  form: AddressFormData;
  onChange: (patch: Partial<AddressFormData>) => void;
  idPrefix?: string;
  required?: boolean;
};

export function AddressFields({ form, onChange, idPrefix = "", required = true }: AddressFieldsProps) {
  const id = (field: string) => (idPrefix ? `${idPrefix}-${field}` : field);
  const [cepTouched, setCepTouched] = useState(false);
  const handleCepResolved = useCallback(
    (patch: Partial<AddressFormData>) => onChange(patch),
    [onChange],
  );
  const { status, isComplete } = useCepLookup(form.cep, handleCepResolved);

  const showCepError = cepTouched && isComplete && (status === "not_found" || status === "error");

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-sm font-medium text-foreground">Endereço</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor={id("cep")}>CEP</Label>
          <Input
            id={id("cep")}
            value={form.cep}
            onChange={(e) => onChange({ cep: formatCep(e.target.value) })}
            onBlur={() => setCepTouched(true)}
            placeholder="00000-000"
            inputMode="numeric"
            maxLength={9}
            required={required}
            autoComplete="postal-code"
          />
          {status === "loading" && (
            <p className="text-xs text-muted-foreground">Buscando CEP...</p>
          )}
          {showCepError && (
            <p className="text-xs text-destructive">CEP não encontrado. Verifique o número.</p>
          )}
        </div>

        <div className="space-y-2 sm:col-span-1">
          <Label htmlFor={id("number")}>Número</Label>
          <Input
            id={id("number")}
            value={form.number}
            onChange={(e) => onChange({ number: e.target.value })}
            placeholder="123"
            required={required}
            autoComplete="off"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("street")}>Rua</Label>
        <Input
          id={id("street")}
          value={form.street}
          onChange={(e) => onChange({ street: e.target.value })}
          placeholder="Preenchido pelo CEP ou edite manualmente"
          required={required}
          autoComplete="street-address"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("complement")}>Complemento</Label>
        <Input
          id={id("complement")}
          value={form.complement}
          onChange={(e) => onChange({ complement: e.target.value })}
          placeholder="Sala, bloco, andar (opcional)"
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={id("neighborhood")}>Bairro</Label>
        <Input
          id={id("neighborhood")}
          value={form.neighborhood}
          onChange={(e) => onChange({ neighborhood: e.target.value })}
          placeholder="Preenchido pelo CEP ou edite manualmente"
          required={required}
          autoComplete="off"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={id("city")}>Cidade</Label>
          <Input
            id={id("city")}
            value={form.city}
            onChange={(e) => onChange({ city: e.target.value, ibge: "" })}
            placeholder="Preenchido pelo CEP ou edite manualmente"
            required={required}
            autoComplete="address-level2"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={id("state")}>UF</Label>
          <Input
            id={id("state")}
            value={form.state}
            onChange={(e) =>
              onChange({ state: e.target.value.toUpperCase().slice(0, 2), ibge: "" })
            }
            placeholder="UF"
            maxLength={2}
            required={required}
            autoComplete="address-level1"
          />
        </div>
      </div>
    </div>
  );
}
