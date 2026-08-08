import AdminWorkspace from "./AdminWorkspace";

/**
 * A rota `/admin`.
 *
 * ## Onde foi parar o portao de segundo fator
 *
 * Ele vivia aqui, envolvendo o painel. Passou para o `AppRoutes`, ao lado dos
 * desvios de `isPasswordRecovery` e `deveTrocarSenha`, por dois motivos:
 *
 * 1. **Valia so para o admin.** Cliente que cadastrava autenticador nunca era
 *    desafiado — o fator ficava decorativo. Agora quem tem fator usa, em
 *    qualquer rota.
 * 2. **Verificacao presa a rota some quando a rota muda de forma.** Este
 *    arquivo ficou orfao por um tempo: `App.tsx` importava `AdminWorkspace`
 *    direto, e o portao — correto e testado — nunca era montado. Alta na
 *    arvore, a verificacao nao tem como ser contornada por navegacao.
 *
 * O que sobrou aqui e so o ponto de entrada da rota. Mantido como arquivo
 * proprio porque e ele que o `App.tsx` importa; apontar a rota direto para o
 * painel foi exatamente o que causou o bug acima.
 */
export default function Admin() {
  return <AdminWorkspace />;
}
