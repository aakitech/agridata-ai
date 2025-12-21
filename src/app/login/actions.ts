
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "~/lib/supabase/server";

export async function login(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  console.log(`[Login Attempt] Email: ${email}`);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error(`[Login Error] Email: ${email}, Message: ${error.message}, Status: ${error.status}`);
    
    let message = error.message;
    if (message === "Email not confirmed") {
      message = "Your email address has not been verified yet. Please check your inbox or use the manual verification script.";
    } else if (message === "Invalid login credentials") {
      message = "Invalid email or password. If you just signed up, make sure your email is confirmed.";
    }
    
    redirect(`/login?error=${encodeURIComponent(message)}`);
  }

  console.log(`[Login Success] User: ${data.user?.email}`);
  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  console.log(`[Signup Attempt] Email: ${email}`);

  const { data: authData, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error(`[Signup Error] Email: ${email}, Message: ${error.message}`);
    redirect("/login?error=" + encodeURIComponent(error.message));
  }

  console.log(`[Signup Result] User: ${authData.user?.email}, Session: ${!!authData.session}`);

  revalidatePath("/", "layout");

  if (!authData.session) {
    // Check if the user already exists but is unconfirmed
    if (authData.user && authData.user.identities?.length === 0) {
       console.log(`[Signup Info] User ${email} already exists but might be unconfirmed.`);
       redirect("/login?error=" + encodeURIComponent("This email is already registered but not verified. Check your spam or click 'Resend Verification'."));
    }
    
    redirect("/login?error=" + encodeURIComponent("Registration successful! Check your email for a verification link. (Note: Supabase limits emails to 3 per hour on the free tier)"));
  }

  redirect("/dashboard");
}

export async function resendVerification(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;

  console.log(`[Resend Attempt] Email: ${email}`);

  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email,
  });

  if (error) {
    console.error(`[Resend Error] Email: ${email}, Message: ${error.message}`);
    redirect("/login?error=" + encodeURIComponent(error.message));
  }

  redirect("/login?error=" + encodeURIComponent("Verification email resent! Please check your inbox and spam folder."));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
