import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { GUEST_MESSAGE_LIMIT } from "@/lib/chat/guestLimit";

export function GuestLimitBanner() {
  return (
    <div
      className="
        mx-auto
        w-full
        max-w-3xl
        rounded-2xl
        border
        px-6
        py-5
      "
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">
            Continue the conversation
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            You've reached the guest limit of{" "}
            {GUEST_MESSAGE_LIMIT} messages.
            Sign in to continue chatting and save your conversations.
          </p>
        </div>

        <SignInButton mode="modal">
          <Button
            className="
              h-10
              rounded-xl
              px-5
            "
          >
            Sign in to continue
          </Button>
        </SignInButton>
      </div>
    </div>
  );
}