
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { createClient } from "~/lib/supabase/server";
import { analyticsEvents } from "~/lib/observability/events";
import { captureServerEvent } from "~/lib/observability/server";

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
  // Capture after the response so analytics never adds latency to login.
  after(
    captureServerEvent(analyticsEvents.userLoggedIn, {
      userId: data.user?.id,
      route: "/login",
    }),
  );
  revalidatePath("/", "layout");
  // After login, we can still redirect to dashboard for better UX, 
  // but the landing page is now accessible if they navigate back.
  redirect("/dashboard");
}

// Public signup is disabled for White Glove Authentication
export async function signup(formData: FormData) {
  redirect("/login?error=" + encodeURIComponent("Public signup is disabled. Please contact an administrator for an invite."));
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
