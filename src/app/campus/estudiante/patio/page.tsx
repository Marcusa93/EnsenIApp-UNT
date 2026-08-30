import { redirect } from "next/navigation";

/** El Patio se convirtió en el Aula Magna Gamer; la URL vieja sigue entrando. */
export default function PatioRedirect() {
  redirect("/campus/estudiante/aula-magna");
}
