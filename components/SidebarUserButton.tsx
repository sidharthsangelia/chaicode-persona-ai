"use client";

import { UserButton } from "@clerk/nextjs";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function SidebarUserButton() {
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <div className={collapsed ? "flex justify-center" : "flex items-center"}>
      <UserButton
        showName={!collapsed}
        appearance={{
          elements: {
            rootBox: collapsed ? "" : "w-full",
            userButtonBox: collapsed ? "" : "w-full flex-row-reverse justify-end",
            userButtonTrigger: cn(
              "rounded-md hover:bg-sidebar-accent",
              collapsed ? "p-1" : "w-full p-1.5",
            ),
            userButtonOuterIdentifier: "text-sm font-medium text-sidebar-foreground",
          },
        }}
      />
    </div>
  );
}