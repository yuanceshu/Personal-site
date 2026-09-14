import Image from "next/image";
import type { ComponentProps } from "react";

type SiteMarkProps = Omit<ComponentProps<typeof Image>, "src" | "alt"> & {
  tone?: "dark" | "light";
};

export function SiteMark({ tone = "dark", style, ...props }: SiteMarkProps) {
  return (
    <Image
      src={`/brand/site-mark-${tone}.png?v=20260913`}
      alt=""
      aria-hidden="true"
      width={202}
      height={232}
      unoptimized
      style={{ ...style, objectFit: "contain" }}
      {...props}
    />
  );
}
