import Link from "next/link";
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
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { listChats } from "@/lib/chat/store";
import { ChatListItem } from "@/components/chat/ChatListItem";
import { groupChatsByDate } from "@/lib/chat/groupByDate";
import { NewChatButton } from "@/components/chat/NewChatButton";
import { SidebarUserButton } from "./SidebarUserButton";

export async function AppSidebar() {
  const { userId } = await auth();
  const chats = userId ? await listChats(userId) : [];
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
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-[11px] font-semibold text-sidebar-primary-foreground">
                A
              </div>
              <span className="truncate text-sm font-semibold group-data-[collapsible=icon]:hidden">
                AfterClass
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
                <Button
                  variant="outline"
                  className="h-8 w-full justify-start gap-2 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
                >
                  <span className="group-data-[collapsible=icon]:hidden">New chat</span>
                </Button>
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
              No conversations yet.
            </div>
          )
        ) : (
          <div className="px-4 py-8 text-center text-sm text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
            Sign in to save conversations and access them from any device.
          </div>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {userId ? (
       <SidebarUserButton />
            ) : (
              <SignInButton mode="modal">
                <Button className="h-8 w-full group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:p-0">
                  <span className="group-data-[collapsible=icon]:hidden">Sign in</span>
                </Button>
              </SignInButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}