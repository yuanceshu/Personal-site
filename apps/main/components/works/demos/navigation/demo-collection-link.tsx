import Link from "next/link";

export const DEMO_COLLECTION_HREF = "/works/demos";
export const DEMO_COLLECTION_LABEL = "返回 Demo 合集";

type DemoCollectionLinkProps = {
  className?: string;
};

export function DemoCollectionLink({ className }: DemoCollectionLinkProps) {
  return (
    <Link
      href={DEMO_COLLECTION_HREF}
      className={className}
      aria-label={DEMO_COLLECTION_LABEL}
    >
      <span aria-hidden="true">←</span>
      <span>{DEMO_COLLECTION_LABEL}</span>
    </Link>
  );
}
