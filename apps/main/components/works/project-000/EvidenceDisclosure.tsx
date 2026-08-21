import type { ReactNode } from "react";

type EvidenceDisclosureProps = {
  label: string;
  title: string;
  children: ReactNode;
};

export function EvidenceDisclosure({ label, title, children }: EvidenceDisclosureProps) {
  return (
    <details className="evidence-disclosure">
      <summary>
        <span>{label}</span>
        <strong>{title}</strong>
        <i aria-hidden="true" />
      </summary>
      <div className="evidence-disclosure__body">{children}</div>
    </details>
  );
}
