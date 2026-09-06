import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { Card, CardTitle, PageHeader } from "@/components/ui";
import { ThemeSegment } from "@/components/shell/theme-toggle";
import { PushToggle } from "@/components/pwa/push-toggle";
import { OperatorCard } from "./_components/operator-card";
import { PasswordForm } from "./password-form";
import { NombreForm } from "./nombre-form";

export const metadata: Metadata = { title: "Mi cuenta · EnsenIA UNT" };

export default async function CuentaPage() {
  const { user, profile } = await requireUser("/campus/cuenta");

  return (
    <>
      <PageHeader
        eyebrow="Mi cuenta"
        title="Cuenta y avisos"
        description={
          profile.email
            ? `Tu cuenta es ${profile.email}. Si entraste con la contraseña inicial que te dio la cátedra, cambiala acá por una propia.`
            : "Tu acceso actual es por nombre (sin email), así que no tiene contraseña para cambiar."
        }
      />
      <div className="flex flex-col gap-4">
        <NombreForm inicial={profile.full_name} />
        {profile.role === "estudiante" && <OperatorCard studentId={user.id} />}
        <Card className="max-w-md">
          <CardTitle eyebrow="Preferencias" as="h2">
            Apariencia
          </CardTitle>
          <p className="mt-1 text-sm text-muted">
            Elegí cómo se ve el campus: automático según tu sistema, papel (claro) o tinta (oscuro).
          </p>
          <div className="mt-3">
            <ThemeSegment />
          </div>
        </Card>
        <PushToggle />
        {profile.email && <PasswordForm />}
      </div>
    </>
  );
}
