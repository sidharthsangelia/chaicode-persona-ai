"use client";

import { MessageSquarePlus } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const RECENT_CHATS = [
  { id: "1", title: "React hooks samjhao", persona: "Hitesh" },
  { id: "2", title: "System design for a URL shortener", persona: "Piyush" },
];

export function AppSidebar() {
  return (
    <Sidebar>
      <SidebarHeader className="p-3">
        <Button variant="outline" className="w-full justify-start gap-2">
          <MessageSquarePlus className="h-4 w-4" />
          New chat
        </Button>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Recent</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {RECENT_CHATS.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton>
                    <span className="truncate">{chat.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}