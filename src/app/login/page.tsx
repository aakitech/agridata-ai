import { login, resendVerification } from "./actions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createTRPCContext } from "~/server/api/trpc";

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
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md space-y-8 rounded-lg bg-white p-8 shadow-md">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900">
            AgriData AI
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to access the dashboard
          </p>
        </div>
        
        {error && (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-500 border border-red-200">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6">
          <div className="-space-y-px rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="sr-only">
                Email address
              </label>
              <input
                id="email-address"
                name="email"
                type="email"
                required
                className="relative block w-full rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="relative block w-full rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <button
              formAction={login}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            >
              Log in
            </button>
          </div>

          <div className="text-center mt-4">
             <button
               formAction={resendVerification}
               className="text-xs text-gray-400 hover:text-green-600 underline"
             >
               Didn't get an email? Resend Verification
             </button>
          </div>
        </form>
      </div>
    </div>
  );
}
