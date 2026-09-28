"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";

export function PageLoader() {
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setReady(true);
      window.setTimeout(() => setHidden(true), 400);
    };

    if (document.readyState === "complete") {
      finish();
    } else {
      window.addEventListener("load", finish);
    }
    // Safety net: never block the page for more than 2.5s even if some
    // background asset is slow to finish loading.
    const fallback = window.setTimeout(finish, 2500);

    return () => {
      window.removeEventListener("load", finish);
      window.clearTimeout(fallback);
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] bg-[var(--color-bg)] flex items-center justify-center transition-opacity duration-400 ${
        ready ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <Logo className="h-14 w-auto animate-pulse" />
    </div>
  );
}
