import { redirect } from "next/navigation";

/** La vieja Biblioteca es hoy el Aula Magna Gamer; se conserva la URL por los
 * accesos guardados y los links ya compartidos. */
export default function BibliotecaRedirect() {
  redirect("/campus/estudiante/aula-magna");
}
