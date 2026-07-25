import { redirect } from "next/navigation";
import { currentSession, isClaimed } from "@/lib/tyler/auth";
import { AdminPanel } from "./AdminPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Manage" };

export default async function AdminPage() {
  if (!(await isClaimed())) redirect("/tyler/setup");
  const session = await currentSession();
  if (!session) redirect("/tyler/login");
  return <AdminPanel username={session.username} viaTailnet={session.viaTailnet} />;
}
