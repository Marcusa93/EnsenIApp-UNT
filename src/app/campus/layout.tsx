import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function CampusLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/campus" className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-accent-2" />
            <span className="font-mono text-xs tracking-widest text-muted uppercase">
              EnsenIA · UNT
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted">{profile?.full_name ?? user.email}</span>
            <span className="rounded-full border border-border px-2 py-0.5 font-mono text-[10px] uppercase text-accent">
              {profile?.role ?? "estudiante"}
            </span>
            <form action="/auth/signout" method="post">
              <button className="text-muted transition hover:text-foreground">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
    </div>
  );
}
