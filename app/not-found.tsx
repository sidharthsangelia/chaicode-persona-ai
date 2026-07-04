import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center px-6">
      <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-muted motion-safe:animate-[float_6s_ease-in-out_infinite]">
          <Compass
            className="h-6 w-6 text-muted-foreground"
            strokeWidth={1.75}
          />
        </div>

        <p className="mb-1 text-sm font-medium tracking-widest text-muted-foreground">
          404
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          This route returned undefined.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Nothing matched what you were looking for. Not even in strict mode.
        </p>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/chat">Back to chat</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}