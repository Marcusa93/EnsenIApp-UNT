import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Mi cuenta · EnsenIA UNT" };

export default async function CuentaPage() {
  const { profile } = await requireUser("/campus/cuenta");

  return (
    <>
      <PageHeader
        eyebrow="Mi cuenta"
        title="Cambiar contraseña"
        description={
          profile.email
            ? `Tu cuenta es ${profile.email}. Si entraste con la contraseña inicial que te dio la cátedra, cambiala acá por una propia.`
            : "Tu acceso actual es por nombre (sin email), así que no tiene contraseña para cambiar."
        }
      />
      {profile.email && <PasswordForm />}
    </>
  );
}
