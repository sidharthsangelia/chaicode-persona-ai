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
  SidebarRail,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { listChats } from "@/lib/chat/store";
import { ChatListItem } from "@/components/chat/ChatListItem";
import { groupChatsByDate } from "@/lib/chat/groupByDate";
import { NewChatButton } from "./chat/NewChatButton";

export async function AppSidebar() {
  const { userId } = await auth();
  const chats = userId ? await listChats(userId) : [];
  const groups = groupChatsByDate(chats);

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="gap-2 p-2">
        <Link
          href="/chat"
          className="flex items-center gap-2 px-1.5 py-1 group-data-[collapsible=icon]:justify-center"
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-foreground text-xs font-semibold text-background">
            AI
          </div>
          <span className="text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Persona AI
          </span>
        </Link>

        {userId ? (
          <NewChatButton />
        ) : (
          <SignInButton mode="modal">
            <Button
              variant="outline"
              className="h-9 w-full justify-start gap-2 rounded-lg px-2.5 text-sm font-normal group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            >
              <span className="group-data-[collapsible=icon]:hidden">
                New chat
              </span>
            </Button>
          </SignInButton>
        )}
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {userId ? (
          groups.length > 0 ? (
            groups.map((group) => (
              <SidebarGroup key={group.label} className="py-1">
                <SidebarGroupLabel className="px-3 text-[11px] font-medium text-muted-foreground/70 group-data-[collapsible=icon]:hidden">
                  {group.label}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-0.5 px-1.5 bg-amber-100">
                    {group.chats.map((chat) => (
                      <ChatListItem key={chat.id} chat={chat} />
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
              No conversations yet.
            </p>
          )
        ) : (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground group-data-[collapsible=icon]:hidden">
            Sign in to save conversations and access them from any device.
          </p>
        )}
      </SidebarContent>
      <SidebarFooter className="border-t p-2">
        {userId ? (
          <div
            className="
        flex
        items-center
        rounded-xl
        px-2
        py-2
        transition-colors
        hover:bg-sidebar-accent
        group-data-[collapsible=icon]:justify-center
      "
          >
            <UserButton
              appearance={{
                elements: {
                  rootBox: "w-full",
                  userButtonBox:
                    "w-full flex-row-reverse justify-end group-data-[collapsible=icon]:justify-center",
                  userButtonTrigger:
                    "w-full rounded-lg p-0 hover:bg-transparent",
                  userButtonOuterIdentifier:
                    "text-sm font-medium text-foreground",
                  userButtonPopoverCard: "rounded-xl",
                },
              }}
              showName
            />
          </div>
        ) : (
          <SignInButton mode="modal">
            <Button
              className="
          h-10
          w-full
          rounded-xl
          text-sm
          font-medium
          group-data-[collapsible=icon]:aspect-square
          group-data-[collapsible=icon]:w-10
        "
            >
              <span className="group-data-[collapsible=icon]:hidden">
                Sign in
              </span>

              <span className="hidden group-data-[collapsible=icon]:inline">
                →
              </span>
            </Button>
          </SignInButton>
        )}
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
