"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Input } from "@/components/ui/input";
import { deleteChatAction, renameChatAction } from "@/actions/chatActions";

import { getPersonaMeta } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { useActiveChat } from "@/lib/chat/activeChatContext";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export function ChatListItem({
  chat,
}: {
  chat: { id: string; title: string | null; personaId: string };
}) {
  const router = useRouter();
const pathname = usePathname();
const { activeChatId } = useActiveChat();

const isActive =
  pathname === `/chat/${chat.id}` ||
  (activeChatId !== null && activeChatId === chat.id);
  const persona = getPersonaMeta(chat.personaId);

  console.log("row:", chat.id, "isActive:", isActive, "pathname:", pathname, "activeChatId:", activeChatId);

  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(chat.title ?? "Untitled chat");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isPending, startTransition] = useTransition();
  const { setOpenMobile } = useSidebar();

  const originalTitle = chat.title ?? "Untitled chat";

  function cancelRename() {
    setTitle(originalTitle);
    setIsEditing(false);
  }

  function commitRename() {
    const trimmed = title.trim();
    setIsEditing(false);
    if (!trimmed || trimmed === originalTitle) {
      setTitle(originalTitle);
      return;
    }
    startTransition(async () => {
      const result = await renameChatAction(chat.id, trimmed);
      if (result?.error) {
        toast.error(result.error);
        setTitle(originalTitle);
        return;
      }
      toast.success("Conversation renamed");
    });
  }

  function confirmDelete() {
    setShowDeleteDialog(false);
    startTransition(async () => {
      const result = await deleteChatAction(chat.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Conversation deleted");
      if (isActive) router.push("/chat");
    });
  }

  if (isEditing) {
    return (
      <SidebarMenuItem >
        <div className="flex items-center gap-1 px-1.5 py-0.5 ">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") cancelRename();
            }}
            autoFocus
            onFocus={(e) => e.target.select()}
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
     <SidebarMenuItem className={cn("group/item relative", isPending && "pointer-events-none opacity-60")}>
  <SidebarMenuButton asChild isActive={isActive} disabled={isPending} tooltip={title}>
    <Link href={`/chat/${chat.id}`} onClick={() => setOpenMobile(false)} className="pr-7">
      <Avatar className="h-4 w-4 shrink-0">
        <AvatarFallback className="text-[8px]">{persona.initials}</AvatarFallback>
      </Avatar>
      <span className="truncate">{title}</span>
    </Link>
  </SidebarMenuButton>

  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <SidebarMenuAction showOnHover className="peer-data-[active=true]/menu-button:opacity-100">
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
              This permanently deletes this conversation and all associated
              messages. This action cannot be undone.
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