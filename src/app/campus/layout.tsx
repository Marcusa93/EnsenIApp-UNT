import { requireUser } from "@/lib/auth";
import { CampusShell } from "@/components/shell/campus-shell";
import { BadgeCelebration } from "@/components/gamification/badge-celebration";

export default async function CampusLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await requireUser("/campus");
  return (
    <CampusShell profile={profile}>
      {profile.role === "estudiante" && <BadgeCelebration userId={user.id} />}
      {children}
    </CampusShell>
  );
}
