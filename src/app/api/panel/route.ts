import { type NextRequest, NextResponse } from "next/server";
import { renderTrpcPanel } from "trpc-ui";
import { appRouter } from "~/server/api/root";

export async function GET(_: NextRequest) {
  return new NextResponse(
    renderTrpcPanel(appRouter, {
      url: "http://localhost:3000/api/trpc",
      transformer: "superjson",
    }),
    {
      status: 200,
      headers: {
        "content-type": "text/html",
      },
    }
  );
}


