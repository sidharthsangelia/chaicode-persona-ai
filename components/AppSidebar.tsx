import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { SignInButton, UserButton } from "@clerk/nextjs";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
} from "@/components/ui/sidebar";

import { Button } from "@/components/ui/button";
import { listChats } from "@/lib/chat/store";
import { ChatListItem } from "./chat/ChatListItem";

export async function AppSidebar() {
  const { userId } = await auth();
  const chats = userId ? await listChats(userId) : [];

  return (
    <Sidebar className="border-r">
      {/* Header */}
      <SidebarHeader className="space-y-4 p-3">
        {/* Branding */}
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-background text-sm font-semibold">
            AI
          </div>

          <div className="min-w-0">
            <p className="truncate text-sm font-semibold tracking-tight">
              Persona AI
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Learn from industry experts
            </p>
          </div>
        </div>

        {/* New chat button */}
        {userId ? (
          <Button
            asChild
            variant="outline"
            className="
              group
              h-11
              w-full
              justify-start
              gap-2
              rounded-xl
              px-3
              font-medium
              transition-all
            "
          >
            <Link href="/chat">
              <MessageSquarePlus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
              New chat
            </Link>
          </Button>
        ) : (
          <SignInButton mode="modal">
            <Button
              variant="outline"
              className="
                group
                h-11
                w-full
                justify-start
                gap-2
                rounded-xl
                px-3
                font-medium
                transition-all
              "
            >
              <MessageSquarePlus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
              New chat
            </Button>
          </SignInButton>
        )}
      </SidebarHeader>

      {/* Chat List */}
      <SidebarContent className="scroll-smooth">
        <SidebarGroup>
          <SidebarGroupLabel className="px-3 text-xs font-medium">
            Conversations
          </SidebarGroupLabel>

          <SidebarGroupContent>
            {userId ? (
              <SidebarMenu className="space-y-0.5 px-2">
                {chats.map((chat) => (
                  <ChatListItem key={chat.id} chat={chat} />
                ))}

                {chats.length === 0 && (
                  <div className="px-3 py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Start a conversation to see it here.
                    </p>
                  </div>
                )}
              </SidebarMenu>
            ) : (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Sign in to save conversations and access them from any device.
                </p>
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t p-3">
        {userId ? (
          <div className="rounded-xl border bg-background p-2">
            <UserButton showName />
          </div>
        ) : (
          <SignInButton mode="modal">
            <Button className="h-11 w-full rounded-xl font-medium">
              Sign in
            </Button>
          </SignInButton>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}