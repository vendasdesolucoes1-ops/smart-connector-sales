import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import logoDark from "@/assets/vs-logo-dark.png";
import logoLight from "@/assets/vs-logo-light.png";

type Variant = "auto" | "light" | "dark";

interface LogoProps {
  variant?: Variant;
  className?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
}

/**
 * VS Sales logo. The brand mark is "VS" — `V` adapts to surface (dark on light,
 * white on dark), `S` is always brand orange. Two PNG variants live in
 * src/assets and are picked by theme. Pass `variant` to force one.
 */
export function Logo({
  variant = "auto",
  className = "h-8 w-auto",
  showWordmark = false,
  wordmarkClassName = "",
}: LogoProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const effective: Exclude<Variant, "auto"> =
    variant !== "auto"
      ? variant
      : mounted && resolvedTheme === "light"
      ? "light"
      : "dark";

  const src = effective === "light" ? logoLight : logoDark;

  return (
    <span className="inline-flex items-center gap-2 select-none">
      <img src={src} alt="VS Sales" className={className} draggable={false} />
      {showWordmark && (
        <span
          className={`text-base font-semibold tracking-[0.18em] ${wordmarkClassName}`}
          style={{ fontFamily: "'Bebas Neue', 'Inter', sans-serif" }}
        >
          SALES
        </span>
      )}
    </span>
  );
}
