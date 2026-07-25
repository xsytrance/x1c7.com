import { redirect } from "next/navigation";
import { isClaimed } from "@/lib/tyler/auth";
import { AuthForm } from "../AuthForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Set up your login" };

/**
 * The door Juan walks through exactly once. After he claims it this page
 * stops existing — anyone who finds the URL later just lands on the sign-in
 * form, which tells them nothing.
 */
export default async function SetupPage() {
  if (await isClaimed()) redirect("/tyler/login");
  return <AuthForm mode="claim" />;
}
