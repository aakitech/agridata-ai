import { HydrateClient } from "~/trpc/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createTRPCContext } from "~/server/api/trpc";

export default async function Home() {
  const ctx = await createTRPCContext({ headers: await headers() });
  
  if (ctx.user) {
    redirect("/dashboard");
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            AgriData <span className="text-[hsl(280,100%,70%)]">AI</span>
          </h1>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-8">
            <div className="flex max-w-xs flex-col gap-4 rounded-xl bg-white/10 p-4 hover:bg-white/20">
              <h3 className="text-2xl font-bold">WhatsApp Bot →</h3>
              <div className="text-lg">
                Our primary ingestion channel. Send a message to start reporting pests and diseases.
              </div>
            </div>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
