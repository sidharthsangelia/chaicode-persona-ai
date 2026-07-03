import Link from "next/link";
import { MessageSquarePlus } from "lucide-react";
import { auth } from "@clerk/nextjs/server";
import { SignInButton, UserButton } from "@clerk/nextjs";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { listChats } from "@/lib/chat/store";

export async function AppSidebar() {
  const { userId } = await auth();
  const chats = userId ? await listChats(userId) : [];

  return (
    <Sidebar>
      <SidebarHeader className="p-3">
        {userId ? (
          <Button asChild variant="outline" className="w-full justify-start gap-2">
            <Link href="/chat">
              <MessageSquarePlus className="h-4 w-4" />
              New chat
            </Link>
          </Button>
        ) : (
          <SignInButton mode="modal">
            <Button variant="outline" className="w-full justify-start gap-2">
              <MessageSquarePlus className="h-4 w-4" />
              New chat
            </Button>
          </SignInButton>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Recent</SidebarGroupLabel>
          <SidebarGroupContent>
            {userId ? (
              <SidebarMenu>
                {chats.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton asChild>
                      <Link href={`/chat/${chat.id}`}>
                        <span className="truncate">{chat.title ?? "Untitled chat"}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {chats.length === 0 && (
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">No saved chats yet.</p>
                )}
              </SidebarMenu>
            ) : (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                Sign in to save your chats and see them here.
              </p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {userId ? <UserButton showName /> : <SignInButton mode="modal"><Button className="w-full">Sign in</Button></SignInButton>}
      </SidebarFooter>
    </Sidebar>
  );
}