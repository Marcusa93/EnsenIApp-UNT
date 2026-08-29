import { redirect } from "next/navigation";

/** La Biblioteca ahora se llama El Patio: se conserva la URL vieja por los
 * accesos guardados y los links ya compartidos. */
export default function BibliotecaRedirect() {
  redirect("/campus/estudiante/patio");
}
