import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";

/** Roughly a screenful, so the real list settles into the space the skeleton
 *  was already holding instead of shoving the footer down. */
const ROWS = ["a", "b", "c", "d", "e", "f"];

/** Holds the sidebar's place while the chat list loads. */
export function ChatListSkeleton() {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {ROWS.map((row) => (
            <SidebarMenuItem key={row}>
              <SidebarMenuSkeleton showIcon />
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
