/**
 * A espera padrao de tela cheia.
 *
 * Vivia dentro do `App.tsx` como `RouteLoader`, usada so pelo `Suspense` das
 * rotas. Saiu para ca quando o portao de segundo fator passou a precisar da
 * mesma coisa: enquanto ele decide, a alternativa era `null`, e medindo deu
 * ~170ms de **tela branca** — trocar um incomodo por outro.
 *
 * O ponto de ser o mesmo componente nos dois lugares e que quem espera nao
 * deveria conseguir dizer de onde vem a espera. Dois carregadores parecidos, mas
 * nao iguais, aparecendo em sequencia, leem-se como a tela piscando duas vezes.
 */
export function CarregandoPagina() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="space-y-3 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Carregando página...</p>
      </div>
    </div>
  );
}
