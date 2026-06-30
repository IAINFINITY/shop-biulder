import clinicMaisLogo from "@/assets/clinicmais-logo.png";
import { cn } from "@/lib/utils";

type ClinicPlusLogoProps = {
  className: string;
  alt: string;
};

export function ClinicPlusLogo({
  className,
  alt = "Clinic+ Suplemento e Nutrição",
}: ClinicPlusLogoProps) {
  return <img src={clinicMaisLogo} alt={alt} className={cn("h-10 w-auto sm:h-11", className)} />;
}
