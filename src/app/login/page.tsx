import { login, resendVerification } from "./actions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createTRPCContext } from "~/server/api/trpc";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await createTRPCContext({ headers: await headers() });
  
  if (ctx.user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const error = params.error;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md space-y-8 rounded-2xl border bg-card p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
          <h2 className="text-3xl font-bold tracking-tight">
            Welcome back
          </h2>
          <p className="text-muted-foreground">
            Sign in to your AgriData AI account
          </p>
        </div>
        
        {error && (
          <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive border border-destructive/20">
            {error}
          </div>
        )}

        <form className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email-address">Email address</Label>
              <Input
                id="email-address"
                name="email"
                type="email"
                required
                placeholder="name@example.com"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="••••••••"
                className="h-11"
              />
            </div>
          </div>

          <Button
            formAction={login}
            className="w-full h-11 text-base font-medium"
          >
            Sign in
          </Button>

          <div className="text-center">
             <button
               formAction={resendVerification}
               className="text-sm text-muted-foreground hover:text-primary underline transition-colors"
             >
               Didn't get an email? Resend Verification
             </button>
          </div>
        </form>
      </div>
    </div>
  );
}
