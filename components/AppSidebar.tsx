import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { SignInButton } from "@clerk/nextjs";
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
import { ChatRow, listChats } from "@/lib/chat/store";
import { ChatListItem } from "@/components/chat/ChatListItem";
import { groupChatsByDate } from "@/lib/chat/groupByDate";
import { NewChatButton } from "@/components/chat/NewChatButton";
import { SidebarUserButton } from "./SidebarUserButton";
import Image from "next/image";
import { LogIn } from "lucide-react";

export async function AppSidebar() {
  const { userId } = await auth();
const chats: ChatRow[] = userId ? await listChats(userId) : [];
  const groups = groupChatsByDate(chats);

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
                alt="Logo"
                width={24}
                height={24}
                className="rounded-full"
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
          groups.length > 0 ? (
            groups.map((group) => (
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
            ))
          ) : (
            <div className="px-4 py-8 text-center text-sm text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
              Nothing here yet — start a conversation.
            </div>
          )
        ) : (
          <div className="px-4 py-8 text-center text-sm text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
            Your chat stays on this device. Sign in anytime to keep it and pick
            up from any device.
          </div>
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
