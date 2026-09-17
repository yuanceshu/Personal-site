import type { ComponentProps, CSSProperties } from "react";
type Props = ComponentProps<"img"> & { fill?: boolean; unoptimized?: boolean; priority?: boolean; preload?: boolean };
export default function Image({ fill, unoptimized, priority, preload, style, ...props }: Props) {
  void unoptimized; void priority; void preload;
  const position: CSSProperties = fill ? { position: "absolute", height: "100%", width: "100%", left: 0, top: 0, right: 0, bottom: 0, color: "transparent" } : {};
  return <img {...props} style={{ ...position, ...style }} />;
}
