"use client";

import { RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Anything that throws below the root layout lands here.
 *
 * The sidebar survives, so the person keeps their other conversations and a way
 * out. Without this boundary a failed Postgres read replaces the entire app
 * with Next's default error page.
 */
export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] render failed:", error);
  }, [error]);

  return (
    <div className="flex h-dvh flex-1 items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold tracking-tight">
          Something broke on our side
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This one is not your fault. Try again, and if it keeps happening your
          other conversations are still in the sidebar.
        </p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <Button onClick={reset} className="gap-2">
            <RefreshCcw className="h-4 w-4" />
            Try again
          </Button>
          <Button asChild variant="ghost">
            <Link href="/chat">Start a new chat</Link>
          </Button>
        </div>

        {error.digest && (
          <p className="mt-6 font-mono text-[11px] text-muted-foreground/60">
            {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
