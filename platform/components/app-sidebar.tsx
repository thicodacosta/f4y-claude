"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { getVisibleNavGroups, ROLE_LABEL, type Papel } from "@/lib/nav";
import { cn } from "@/lib/utils";

function initials(nome: string) {
  return nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function AppSidebar({ papel, nome }: { papel: Papel | null; nome: string }) {
  const pathname = usePathname();
  const groups = getVisibleNavGroups(papel);

  return (
    <div className="flex h-full flex-col gap-5 p-3.5">
      <div className="flex items-center gap-2.5 px-1.5 pb-1">
        <Image
          src="/logo-monogram.png"
          alt="Find4You"
          width={32}
          height={32}
          className="shrink-0 rounded-md"
        />
        <div className="min-w-0">
          <div className="truncate font-heading text-[15px] font-bold leading-tight">
            Find4You
          </div>
          <div className="truncate text-[10.5px] uppercase tracking-wide text-muted-foreground">
            Business Platform
          </div>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="mb-1 px-2.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                      active && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="rounded-md bg-muted px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        <span className="font-semibold text-foreground/80">Copiloto de IA</span> — chega na
        Fase 8 do roadmap.
      </div>

      <div className="flex items-center gap-2 px-1.5">
        <div
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, var(--brand-indigo), var(--primary))" }}
        >
          {initials(nome)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-semibold">{nome}</div>
          <div className="truncate text-[11px] text-muted-foreground">
            {papel ? ROLE_LABEL[papel] : "Papel não definido"}
          </div>
        </div>
      </div>
    </div>
  );
}
