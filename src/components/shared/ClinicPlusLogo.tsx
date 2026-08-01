import clinicMaisLogo from "@/assets/clinicmais-logo.png";
import { cn } from "@/lib/utils";

/** Opcionais: as duas tem padrao no componente, e a maioria dos usos e `<ClinicPlusLogo />`. */
type ClinicPlusLogoProps = {
  className?: string;
  alt?: string;
};

export function ClinicPlusLogo({
  className,
  alt = "Clinic+ Suplemento e Nutrição",
}: ClinicPlusLogoProps) {
  return (
    <img
      src={clinicMaisLogo}
      alt={alt}
      width={513}
      height={149}
      decoding="async"
      className={cn("h-10 w-auto sm:h-11", className)}
    />
  );
}
