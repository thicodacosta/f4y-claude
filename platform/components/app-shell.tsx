"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserMenu } from "@/components/user-menu";
import { NotificationBell, type NotificacaoClient } from "@/components/notificacoes/notification-bell";
import { CommandPalette } from "@/components/command-palette";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { findNavItem, type Papel } from "@/lib/nav";

export function AppShell({
  papel,
  nome,
  email,
  notificacoes,
  children,
}: {
  papel: Papel | null;
  nome: string;
  email: string;
  notificacoes: NotificacaoClient[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const current = findNavItem(pathname);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 border-r border-border bg-sidebar lg:block print:hidden">
        <AppSidebar papel={papel} nome={nome} />
      </aside>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Menu</SheetTitle>
          </SheetHeader>
          <AppSidebar papel={papel} nome={nome} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-3 sm:px-6 print:hidden">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label="Abrir menu"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu className="size-4" />
            </Button>
            <p className="truncate text-xs text-muted-foreground">
              Find4You <span className="mx-1">&rsaquo;</span>
              <span className="font-semibold text-foreground">
                {current?.label ?? "Dashboard"}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <CommandPalette papel={papel} />
            <NotificationBell notificacoes={notificacoes} />
            <ThemeToggle />
            <UserMenu nome={nome} email={email} />
          </div>
        </header>

        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
