"use client";

import Link from "next/link";
import { MessageSquarePlus, PenSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";

export function NewChatButton() {
  const { setOpenMobile } = useSidebar();
  return (
    <Button
      asChild
      variant="outline"
      className="mt-5 h-9 w-full justify-start gap-2 rounded-lg px-2.5 text-sm font-normal group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
    >
      <Link href="/chat" onClick={() => setOpenMobile(false)}>
        <MessageSquarePlus className="h-4 w-4 shrink-0" />
        <span className="group-data-[collapsible=icon]:hidden">New chat</span>
      </Link>
    </Button>
  );
}