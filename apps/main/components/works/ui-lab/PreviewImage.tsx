"use client";

import { useState } from "react";

export function PreviewImage({ src, alt, width, height, onLoad, eager = false }: {
  src: string; alt: string; width: number; height: number; onLoad?: () => void; eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="uil-image-fallback" role="status">预览暂不可用<span>{alt}</span></div>;
  // Immutable pre-sized screenshots; do not send them through an image service.
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={image => { if (image?.complete && image.naturalWidth === 0) setFailed(true); }} src={src} alt={alt} width={width} height={height} loading={eager ? "eager" : "lazy"} decoding="async" onLoad={onLoad} onError={() => setFailed(true)} />;
}
