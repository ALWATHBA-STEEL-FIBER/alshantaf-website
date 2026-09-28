"use client";

import Link from "next/link";
import { useLanguage } from "@/lib/LanguageProvider";

export default function NotFound() {
  const { lang } = useLanguage();
  const isAr = lang === "ar";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-green px-4 text-center text-white">
      <img
        src="/icon.png"
        alt="ALSHANTAF INVEST"
        width={96}
        height={96}
        className="w-24 h-24 mb-6 rounded-2xl shadow-[0_12px_40px_-16px_rgba(0,0,0,0.45)]"
      />
      <span className="text-gold text-sm font-bold tracking-widest">404</span>
      <h1 className="text-3xl font-bold mt-3">
        {isAr ? "الصفحة غير موجودة" : "Page not found"}
      </h1>
      <p className="text-white/70 mt-3 max-w-sm">
        {isAr
          ? "الرابط الذي تحاول الوصول إليه غير متاح أو تم نقله."
          : "The link you're looking for isn't available or has moved."}
      </p>
      <Link href="/" className="mt-8 h-12 px-6 rounded-full bg-white text-green font-bold flex items-center hover:bg-white/90 transition-colors">
        {isAr ? "العودة إلى الرئيسية" : "Back to home"}
      </Link>
    </div>
  );
}
