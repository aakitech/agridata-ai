"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "~/lib/supabase/client";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { api } from "~/trpc/react";

export default function AcceptInvitePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const activate = api.users.activate.useMutation();

  useEffect(() => {
    const hash = window.location.hash;
    const hasToken = hash.includes("access_token=");
    const searchParams = new URLSearchParams(window.location.search);
    const urlError = searchParams.get("error");
    const tokenHash = searchParams.get("token_hash");
    const type = searchParams.get("type") as EmailOtpType | null;

    if (urlError) {
        setPageError(urlError);
        setIsCheckingSession(false);
        return;
    }
    
    // 1. Listen for session being established (Moved up to catch early events)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("[AcceptInvite] Auth event:", event, session?.user?.email);
      
      if (session) {
        // Only proceed if it's the expected user OR if we haven't decoded an email yet
        setIsCheckingSession(false);
        setPageError(null);
        if (session.user.email) setUserEmail(session.user.email);
      }
    });

    // 2. Check for errors in the URL fragment immediately
    if (hash.includes("error=")) {
        const params = new URLSearchParams(hash.replace('#', ''));
        const errorMsg = params.get("error_description") || "Invitation link invalid";
        setPageError(errorMsg);
        setIsCheckingSession(false);
        return;
    }

    if (tokenHash && type) {
        supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type,
        }).then(({ data, error }) => {
            if (error) {
                setPageError(error.message || "Email link is invalid or expired");
                setIsCheckingSession(false);
                return;
            }
            if (data.session) {
                setUserEmail(data.session.user.email ?? null);
                setPageError(null);
                setIsCheckingSession(false);
            }
        }).catch((err) => {
            console.error("Failed to verify invite token", err);
            setPageError("Email link is invalid or expired");
            setIsCheckingSession(false);
        });
        return () => subscription.unsubscribe();
    }

    if (hasToken) {
        const params = new URLSearchParams(hash.replace('#', ''));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (accessToken) {
            const parts = accessToken.split('.');
            if (parts[1]) {
                try {
                    const payload = JSON.parse(atob(parts[1]));
                    if (payload.email) setUserEmail(payload.email);
                } catch (e) {
                    console.error("Failed to decode token", e);
                }
            }

            // FORCE: Manually inject the session from the URL
            if (refreshToken) {
                console.log("[AcceptInvite] Forcing session from URL tokens...");
                supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken
                }).catch(err => console.error("Failed to set manual session", err));
            }
        }
    }

    // 3. Initial check
    const checkInitial = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
            // Only auto-proceed if no token is present (normal page visit)
            // or if the session matches the token we see.
            if (!hasToken || (userEmail && session.user.email === userEmail)) {
              setUserEmail(session.user.email ?? null);
              setIsCheckingSession(false);
            }
        } 
        
        // If we have a token but no session yet, or we want to be safe, wait.
        const timeout = setTimeout(async () => {
            const { data: { session: finalSession } } = await supabase.auth.getSession();
            if (!finalSession) {
                if (hasToken) {
                    setPageError("The invitation session could not be established. This usually happens if the link is expired or has been used already.");
                } else {
                    setPageError("No active invitation found. Please use the link sent to your email.");
                }
            }
            setIsCheckingSession(false);
        }, hasToken ? 6000 : 2000); // 6 seconds for token parsing safety

        return () => clearTimeout(timeout);
    };
    
    checkInitial();

    return () => subscription.unsubscribe();
  }, [router, userEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      // Mark local profile as active
      await activate.mutateAsync();

      toast.success("Account setup complete! Redirecting...");
      router.push("/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to finalize account");
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto" />
          <p className="text-sm text-gray-600">Verifying invitation...</p>
        </div>
      </div>
    );
  }

  if (pageError) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
          <div className="w-full max-w-md space-y-6 rounded-lg bg-white p-8 shadow-md text-center border-t-4 border-red-500">
            <h2 className="text-2xl font-bold text-gray-900">Invitation Error</h2>
            <p className="text-gray-600">{pageError}</p>
            <Button 
                onClick={() => router.push("/login")}
                className="w-full"
                variant="outline"
            >
                Back to Login
            </Button>
          </div>
        </div>
      );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-md">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">
            Welcome to AgriData AI
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Account setup for: <span className="font-semibold text-gray-900">{userEmail}</span>
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Please set your password to complete your registration.
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
              />
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="********"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={isLoading}
          >
            {isLoading ? "Setting Password..." : "Set Password & Login"}
          </Button>
        </form>
      </div>
    </div>
  );
}
