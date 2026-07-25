import { redirect } from "next/navigation";
import { isClaimed } from "@/lib/tyler/auth";
import { AuthForm } from "../AuthForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  // Before anyone has claimed the site, "sign in" is a dead end — send the
  // first arrival to the setup they actually need.
  if (!(await isClaimed())) redirect("/tyler/setup");
  return <AuthForm mode="login" />;
}
