import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { GUEST_MESSAGE_LIMIT } from "@/lib/chat/guestLimit";
 

export function GuestLimitBanner() {
  return (
    <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
      <span className="text-muted-foreground">
        You&apos;ve hit the {GUEST_MESSAGE_LIMIT}-message guest limit for this chat.
      </span>
      <SignInButton mode="modal">
        <Button size="sm">Sign in to keep chatting</Button>
      </SignInButton>
    </div>
  );
}