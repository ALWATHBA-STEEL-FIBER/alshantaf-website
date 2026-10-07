"use client";

import { useRef } from "react";
import { UploadIcon } from "@/components/icons";

export function FilePickerButton({
  label,
  accept,
  multiple,
  onFiles,
  icon,
  disabled,
  className = "",
}: {
  label: string;
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        className={`w-full h-11 px-4 rounded-xl border-2 border-dashed border-line bg-surface-2 flex items-center justify-center gap-2 text-sm font-bold text-ink-soft transition-colors hover:border-gold hover:text-green disabled:opacity-50 disabled:pointer-events-none ${className}`}
      >
        {icon ?? <UploadIcon className="w-4 h-4" />}
        {label}
      </button>
    </>
  );
}
