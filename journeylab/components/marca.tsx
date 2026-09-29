import Link from "next/link";
import { cn } from "@/lib/utils";

/** Marca JourneyLab (provisória em código — substituir pelo logo oficial do site quando disponível). */
export function Simbolo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-8 shrink-0", className)}>
      <rect width="32" height="32" rx="8" fill="#0B1F3A" />
      <path d="M9 21.5c3.2 0 4.6-2.2 5.6-5.2S16.8 10.5 20 10.5" fill="none" stroke="#14B8A6" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="9" cy="21.5" r="2.2" fill="#FFFFFF" />
      <circle cx="22.8" cy="10.5" r="2.2" fill="#14B8A6" />
    </svg>
  );
}

export function Logo({ href = "/inicio", claro = false, className }: { href?: string; claro?: boolean; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 rounded-md outline-offset-4", className)} aria-label="JourneyLab — início">
      <Simbolo />
      <span className={cn("font-heading text-[17px] font-extrabold tracking-tight", claro ? "text-white" : "text-foreground")}>
        Journey<span className="text-teal-strong dark:text-teal">Lab</span>
      </span>
    </Link>
  );
}
