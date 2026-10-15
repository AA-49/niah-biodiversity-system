"use server";

import { redirect } from "next/navigation";
import { authConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { error: string | null };

export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  if (!authConfigured) {
    return { error: "Sign in isn’t set up on this server yet." };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // One message for a wrong email and a wrong password, so it can't be
    // used to find out which emails have accounts.
    return { error: "That email and password don’t match an account." };
  }

  redirect("/dashboard");
}

export async function signOut() {
  if (authConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
