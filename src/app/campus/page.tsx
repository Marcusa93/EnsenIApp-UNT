import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { homeForRole } from "@/lib/nav";

export default async function CampusIndex() {
  const { profile } = await requireUser("/campus");
  redirect(homeForRole(profile.role));
}
