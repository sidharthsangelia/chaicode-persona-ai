"use client";

import { Check, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteChatAction, renameChatAction } from "@/actions/chatActions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useActiveChat } from "@/lib/chat/activeChatContext";
import { getPersonaMeta } from "@/lib/personas";
import { cn } from "@/lib/utils";

export function ChatListItem({
  chat,
}: {
  chat: { id: string; title: string | null; personaId: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { activeChatId } = useActiveChat();
  const { setOpenMobile } = useSidebar();

  const serverTitle = chat.title ?? "Untitled chat";
  const persona = getPersonaMeta(chat.personaId);

  // activeChatId covers the gap on a brand new chat, where the row exists
  // before the URL has caught up with it.
  const isActive = pathname === `/chat/${chat.id}` || activeChatId === chat.id;

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(serverTitle);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Both actions revalidate the whole layout, which is a slow round trip to sit
  // through for something the user already decided. The row shows the outcome
  // immediately and React rolls it back on its own if the action fails.
  const [title, setOptimisticTitle] = useOptimistic(serverTitle);
  const [isDeleted, setOptimisticDeleted] = useOptimistic(false);

  function cancelRename() {
    setDraft(serverTitle);
    setIsEditing(false);
  }

  function commitRename() {
    const trimmed = draft.trim();
    setIsEditing(false);
    if (!trimmed || trimmed === serverTitle) {
      setDraft(serverTitle);
      return;
    }
    startTransition(async () => {
      setOptimisticTitle(trimmed);
      const result = await renameChatAction(chat.id, trimmed);
      if (result?.error) {
        toast.error(result.error);
        setDraft(serverTitle);
      }
    });
  }

  function confirmDelete() {
    setShowDeleteDialog(false);
    startTransition(async () => {
      setOptimisticDeleted(true);
      const result = await deleteChatAction(chat.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Conversation deleted");
      if (isActive) router.push("/chat");
    });
  }

  if (isDeleted) return null;

  if (isEditing) {
    return (
      <SidebarMenuItem>
        <div className="flex items-center gap-1 px-1.5 py-0.5">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") cancelRename();
            }}
            autoFocus
            onFocus={(e) => e.target.select()}
            aria-label="Conversation title"
            className="h-8 rounded-md text-sm"
          />
          <button
            type="button"
            onClick={commitRename}
            className="shrink-0 rounded-md p-1.5 hover:bg-sidebar-accent"
            aria-label="Save"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={cancelRename}
            className="shrink-0 rounded-md p-1.5 hover:bg-sidebar-accent"
            aria-label="Cancel"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </SidebarMenuItem>
    );
  }

  return (
    <>
      <SidebarMenuItem
        className={cn("group/item relative", isPending && "opacity-70")}
      >
        <SidebarMenuButton asChild isActive={isActive} tooltip={title}>
          <Link
            href={`/chat/${chat.id}`}
            onClick={() => setOpenMobile(false)}
            className="pr-7"
          >
            <Avatar className="h-4 w-4 shrink-0">
              <AvatarFallback className="text-[8px]">
                {persona.initials}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{title}</span>
          </Link>
        </SidebarMenuButton>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuAction
              showOnHover
              className="peer-data-[active=true]/menu-button:opacity-100"
            >
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Conversation options</span>
            </SidebarMenuAction>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-44">
            <DropdownMenuItem
              onSelect={() => setIsEditing(true)}
              className="gap-2"
            >
              <Pencil className="h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => setShowDeleteDialog(true)}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes &ldquo;{title}&rdquo; and every message
              in it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
