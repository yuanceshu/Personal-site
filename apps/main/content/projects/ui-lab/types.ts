export type Disclosure = { value: "yes" | "no" | "unknown"; note: string };
export type Preview = {
  src: string; width: number; height: number;
  viewport: { width: number; height: number };
  overflow: boolean; innerScroll: number;
};
export type UiVariant = {
  id: string; slug: string; title: string; model: string;
  modelVersion: string | null; reasoningEffort: string | null;
  skillMode: "bare" | "skill" | "unknown";
  skillName: string | null; skillVersion: string | null;
  createdAt: string | null; frozenAt: string;
  promptSummary: string; additionalConstraints: string[];
  references: Disclosure; imageGeneration: Disclosure;
  sourceType: "frozen-static-snapshot"; sourceEvidence: string;
  entryUrl: string; desktopPreview: Preview; mobilePreview: Preview;
  thumbnail: string; previewState: string; viewportMode: "fluid" | "desktop-only";
  supportedViewports: string[]; limitations: string[];
  interactionSummary: string[]; assetDisclosure: string; archiveChanges: string[];
  observations: Record<string, string>;
  status: "ready" | "incomplete" | "archived";
};
export type UiExperiment = {
  id: string; slug: string; title: string; subtitle: string; description: string;
  category: "dashboard" | "ai-workbench" | "travel" | "other";
  coverImage: string; briefSummary: string;
  comparisonLevel: "controlled" | "partial" | "showcase"; comparisonNote: string;
  defaultVariantIds: [string, string]; featuredVariantIds: string[]; variants: UiVariant[];
};
