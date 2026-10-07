import { cookies } from "next/headers";
import { dictionary, type Lang } from "./dictionary";

export async function getServerLang(): Promise<Lang> {
  const cookieStore = await cookies();
  return cookieStore.get("lang")?.value === "en" ? "en" : "ar";
}

export async function getServerDict() {
  const lang = await getServerLang();
  return { lang, t: dictionary[lang] };
}
