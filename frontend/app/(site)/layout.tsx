import { getPublicSettingsServer, getTeamServer } from "@/lib/api";
import { SettingsProvider } from "@/lib/SettingsProvider";
import { TeamProvider } from "@/lib/TeamProvider";
import { JourneyProvider } from "@/lib/journey/JourneyProvider";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { DeferredSiteChrome } from "@/components/DeferredSiteChrome";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, team] = await Promise.all([getPublicSettingsServer(), getTeamServer()]);

  return (
    <SettingsProvider settings={settings}>
      <TeamProvider team={team}>
        <JourneyProvider>
          <Header />
          <main>{children}</main>
          <Footer />
          <DeferredSiteChrome />
        </JourneyProvider>
      </TeamProvider>
    </SettingsProvider>
  );
}
