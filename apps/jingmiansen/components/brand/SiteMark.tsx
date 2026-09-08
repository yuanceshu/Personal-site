import Image from "next/image";
import type { ComponentProps } from "react";

type SiteMarkProps = Omit<ComponentProps<typeof Image>, "src" | "alt"> & {
  tone?: "dark" | "light";
};

export function SiteMark({ tone = "dark", ...props }: SiteMarkProps) {
  return (
    <Image
      src={`/brand/site-mark-${tone}.png`}
      alt=""
      aria-hidden="true"
      width={80}
      height={112}
      {...props}
    />
  );
}
