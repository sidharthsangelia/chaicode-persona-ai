import { SignInButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { LogIn } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ChatListItem } from "@/components/chat/ChatListItem";
import { ChatListSkeleton } from "@/components/chat/ChatListSkeleton";
import { NewChatButton } from "@/components/chat/NewChatButton";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { groupChatsByDate } from "@/lib/chat/groupByDate";
import { listChats } from "@/lib/chat/store";
import { SidebarUserButton } from "./SidebarUserButton";

const emptyStateClass =
  "px-4 py-8 text-center text-sm text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden";

/**
 * This component sits in the root layout, so anything it awaits is awaited by
 * every page in the app before a single byte of HTML goes out. auth() is a
 * local token read and cheap enough to keep here; the chat list is a Postgres
 * round trip, so it renders behind Suspense and streams in on its own.
 */
export async function AppSidebar() {
  const { userId } = await auth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <Link
              href="/chat"
              className="flex h-9 items-center gap-2 rounded-md px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            >
              <Image
                src="/logo1.png"
                alt=""
                width={24}
                height={24}
                className="rounded-full"
                priority
              />
              <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
                After Class
              </span>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarMenu>
          <SidebarMenuItem>
            {userId ? (
              <NewChatButton />
            ) : (
              <SignInButton mode="modal">
                <SidebarMenuButton
                  tooltip="Sign in"
                  className="justify-start gap-2"
                >
                  <LogIn />
                  <span>Sign in</span>
                </SidebarMenuButton>
              </SignInButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {userId ? (
          <Suspense fallback={<ChatListSkeleton />}>
            <ChatList userId={userId} />
          </Suspense>
        ) : (
          <p className={emptyStateClass}>
            Your chat stays on this device. Sign in anytime to keep it and pick
            up from any device.
          </p>
        )}
      </SidebarContent>

      <SidebarFooter>
        {userId && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarUserButton />
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

async function ChatList({ userId }: { userId: string }) {
  const chats = await listChats(userId);
  if (chats.length === 0) {
    return <p className={emptyStateClass}>Nothing here yet. Start a chat.</p>;
  }

  return groupChatsByDate(chats).map((group) => (
    <SidebarGroup key={group.label}>
      <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {group.chats.map((chat) => (
            <ChatListItem key={chat.id} chat={chat} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  ));
}
