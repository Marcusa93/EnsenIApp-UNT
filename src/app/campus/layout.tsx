import { requireUser } from "@/lib/auth";
import { CampusShell } from "@/components/shell/campus-shell";

export default async function CampusLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser("/campus");
  return <CampusShell profile={profile}>{children}</CampusShell>;
}
