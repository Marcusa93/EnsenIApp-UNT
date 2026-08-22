import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function CampusIndex() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role === "docente" || profile?.role === "admin") {
    redirect("/campus/docente");
  }
  redirect("/campus/estudiante");
}
