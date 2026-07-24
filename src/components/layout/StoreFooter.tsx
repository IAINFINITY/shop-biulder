import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ClinicPlusLogo } from "@/components/shared/ClinicPlusLogo";
import { useCart } from "@/hooks/useCart";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  ChevronRight,
  Instagram,
  Youtube,
  Facebook,
  ShoppingBag,
  User,
  FileText,
  HelpCircle,
} from "lucide-react";

const COMPANY = {
  name: "Clinic+ Suplemento e Nutrição",
  legalName: "AMAIS INDUSTRIA DE ALIMENTOS LTDA",
  cnpj: "04.163.851/0001-06",
  address: "Rua Lauro Muller, 60, Matinho",
  city: "Xanxerê/SC",
  cep: "89820-000",
  phone: "(49) 3433-5400",
  whatsapp: "(49) 2020-9980",
  whatsappLink: "https://wa.me/554920209980",
  email: "atendimento@amaiss.com.br",
  hours: "Seg a Sex, 7:30 às 17:00",
};

const SOCIAL = [
  { label: "Instagram", href: "https://www.instagram.com/clinic.mais/", icon: Instagram },
  { label: "Facebook", href: "https://www.facebook.com/clinic.maisoficial", icon: Facebook },
  { label: "Youtube", href: "https://www.youtube.com/@ClinicMaisOficial", icon: Youtube },
  { label: "Pinterest", href: "https://br.pinterest.com/clinicmais/", icon: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z" />
    </svg>
  )},
  { label: "Blog", href: "https://blog.clinicmais.com.br/", icon: (props) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M2.5 2.5C1.12 2.5 0 3.62 0 5v14c0 1.38 1.12 2.5 2.5 2.5h19c1.38 0 2.5-1.12 2.5-2.5V5c0-1.38-1.12-2.5-2.5-2.5h-19zm0 2h19c.28 0 .5.22.5.5v14c0 .28-.22.5-.5.5h-19c-.28 0-.5-.22-.5-.5V5c0-.28.22-.5.5-.5zm2 3v2h7v-2h-7zm0 4v2h11v-2h-11zm0 4v2h13v-2h-13z" />
    </svg>
  )},
];

const QUICK_LINKS = [
  { label: "Catálogo", href: "/", icon: ShoppingBag },
  { label: "Meus pedidos", href: "/conta?section=pedidos", icon: FileText },
  { label: "Minha conta", href: "/conta", icon: User },
  { label: "Ajuda", href: "/ajuda", icon: HelpCircle },
];

const HELP_LINKS = [
  { label: "Como funciona", href: "/ajuda#como-funciona" },
  { label: "Pedidos", href: "/ajuda#pedidos" },
  { label: "Conta", href: "/ajuda#conta" },
  { label: "Catálogo", href: "/ajuda#catalogo" },
];

function FooterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/60">
        {title}
      </h3>
      {children}
    </div>
  );
}

function InfinityBrandMark() {
  return (
    <a
      href="https://iainfinity.com.br/"
      target="_blank"
      rel="noreferrer"
      className="group inline-flex flex-col gap-2 transition-opacity hover:opacity-90"
      aria-label="Abrir site da IA Infinity"
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70 group-hover:text-primary/90">
        Site desenvolvido pela
      </p>
      <img
        src="/iainfinityclarologo.svg"
        alt="IA Infinity"
        className="h-7 w-auto rounded-lg bg-background p-0.5 shadow-sm transition-transform group-hover:scale-[1.02]"
      />
    </a>
  );
}

function ContactItem({ icon: Icon, label, href }: { icon: typeof Phone; label: string; href?: string }) {
  const content = (
    <span className="flex items-center gap-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <Icon className="h-4 w-4 shrink-0 text-primary/60" />
      <span>{label}</span>
    </span>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block">
        {content}
      </a>
    );
  }

  return content;
}

export function StoreFooter() {
  const navigate = useNavigate();
  const { cart } = useCart();

  const handleMyOrdersClick = () => {
    if (cart.length === 0) {
      toast.info("Seu carrinho está vazio. Adicione produtos para finalizar um pedido.");
      navigate("/");
      return;
    }
    navigate("/pedido");
  };

  return (
    <footer className="border-t border-border/60 bg-gradient-to-b from-background to-muted/20">
      <div className="mx-auto w-full px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.25fr_0.82fr_0.82fr_1.25fr] lg:gap-12">
          {/* Brand */}
          <div className="space-y-4 sm:col-span-2 lg:col-span-1">
            <ClinicPlusLogo className="h-9 sm:h-10" alt="Clinic+ Suplemento e Nutrição" />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Suplementos e nutrição para o seu dia a dia. Qualidade e confiança para
              revendedores e distribuidores em todo o Brasil.
            </p>
            <InfinityBrandMark />
            <div className="flex items-center gap-2.5 pt-1">
              {SOCIAL.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground shadow-sm transition-all hover:border-primary/30 hover:text-primary hover:shadow-md"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="lg:justify-self-center lg:max-w-[240px]">
            <FooterSection title="Links rápidos">
              <ul className="space-y-2.5">
                {QUICK_LINKS.map(({ label, href, icon: Icon }) => (
                  <li key={label}>
                    {label === "Meus pedidos" ? (
                      <button
                        type="button"
                        onClick={handleMyOrdersClick}
                        className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Icon className="h-3.5 w-3.5 text-primary/50 transition-colors group-hover:text-primary/80" />
                        {label}
                        <ChevronRight className="h-3 w-3 -translate-x-1 text-primary/30 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                      </button>
                    ) : (
                      <Link
                        to={href}
                        viewTransition
                        className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Icon className="h-3.5 w-3.5 text-primary/50 transition-colors group-hover:text-primary/80" />
                        {label}
                        <ChevronRight className="h-3 w-3 -translate-x-1 text-primary/30 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </FooterSection>
          </div>

          {/* Contact */}
          <div className="lg:justify-self-center lg:max-w-[240px]">
            <FooterSection title="Atendimento">
              <ul className="space-y-3">
                <li>
                  <ContactItem icon={Phone} label={COMPANY.phone} href={`tel:${COMPANY.phone.replace(/\D/g, "")}`} />
                </li>
                <li>
                  <ContactItem icon={Mail} label={COMPANY.email} href={`mailto:${COMPANY.email}`} />
                </li>
                <li>
                  <ContactItem icon={MapPin} label={`${COMPANY.address} · ${COMPANY.city}`} />
                </li>
                <li className="flex items-start gap-3 text-sm text-muted-foreground">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary/60" />
                  <div>
                    <p>{COMPANY.hours}</p>
                  </div>
                </li>
              </ul>
            </FooterSection>
          </div>

          {/* Help */}
          <div className="lg:justify-self-end lg:max-w-[240px]">
            <FooterSection title="Ajuda rápida">
              <ul className="space-y-2.5">
                {HELP_LINKS.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      to={href}
                      viewTransition
                      className="group inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ChevronRight className="h-3.5 w-3.5 text-primary/50 transition-colors group-hover:text-primary/80" />
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </FooterSection>
          </div>


        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-border/40 bg-muted/30">
        <div className="mx-auto flex w-full flex-col items-center justify-between gap-2 px-4 py-4 text-[11px] text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <p>
            &copy; {new Date().getFullYear()} {COMPANY.legalName}. Todos os direitos reservados.
          </p>
          <p>CNPJ: {COMPANY.cnpj}</p>
        </div>
      </div>
    </footer>
  );
}
