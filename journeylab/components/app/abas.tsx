"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type Aba = { href: string; rotulo: string; exato?: boolean };

export function Abas({ abas, rotulo }: { abas: Aba[]; rotulo: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={rotulo} className="max-w-full overflow-x-auto">
      <ul className="flex w-max gap-1 rounded-md border border-border bg-card p-1 shadow-surface">
        {abas.map((a) => {
          const ativo = a.exato ? pathname === a.href : pathname === a.href || pathname.startsWith(`${a.href}/`);
          return (
            <li key={a.href}>
              <Link
                href={a.href}
                aria-current={ativo ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center rounded-sm px-3.5 text-[13px] font-medium whitespace-nowrap text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  ativo && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                )}
              >
                {a.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
