"use client";

import { useEffect } from "react";
import { DEV_SIGNATURE } from "@/lib/devSignature";

/**
 * Hidden craft mark for anyone inspecting source / DevTools.
 * Nothing here is painted in the public UI.
 */
export function DevSignature() {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.builtBy = DEV_SIGNATURE;
    if (typeof console !== "undefined" && typeof console.info === "function") {
      console.info(
        `%c${DEV_SIGNATURE}%c — built this`,
        "font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;font-weight:700;color:#c89a58;background:#0f342f;padding:3px 8px;border-radius:4px;",
        "font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#5d6b74;padding-left:8px;"
      );
    }
  }, []);

  return (
    <>
      <span
        id="wal8y"
        hidden
        aria-hidden="true"
        data-dev={DEV_SIGNATURE}
        data-signature={DEV_SIGNATURE}
        data-built-by={DEV_SIGNATURE}
        dangerouslySetInnerHTML={{ __html: `<!-- signature:${DEV_SIGNATURE} -->` }}
      />
    </>
  );
}
