import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import "./globals.css";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ActiveChatProvider } from "@/lib/chat/activeChatContext";

/**
 * No next/font loads here on purpose.
 *
 * Geist, Geist Mono and Inter were all being fetched, and none of them ever
 * rendered: globals.css sets `--font-sans: DM Sans` on :root, which ships in a
 * later stylesheet than the font vars and wins the tie on specificity. Three
 * font families were downloaded on every visit to be overridden by a family
 * that is not loaded at all, so the page falls through to the system stack.
 *
 * Removing them is purely a saving. Loading DM Sans and Space Mono for real is
 * the separate, deliberate change, since that one alters how the app looks.
 */
export const metadata: Metadata = {
  title: "After Class",
  description:
    "Ask a 22 hour Expo and React Native course anything and get the module, chapter and timestamp to jump to, answered in the voice of Hitesh Choudhary or Piyush Garg.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className="h-full font-sans antialiased"
        suppressHydrationWarning
      >
        <body className="flex min-h-full flex-col">
          <TooltipProvider>
            <ActiveChatProvider>
              <SidebarProvider>
                <AppSidebar />
                {children}
                <Analytics />
              </SidebarProvider>
            </ActiveChatProvider>
          </TooltipProvider>
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
