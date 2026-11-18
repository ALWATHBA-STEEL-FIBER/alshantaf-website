export function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M1.5 5.2l2.3 2.3 4.7-4.9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
      className="block shrink-0"
    >
      <path d="M4.5 4.5l9 9M13.5 4.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function EmailIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5" y="4.5" width="15" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3.5 5.5l6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PhoneIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5.2 3.5h2.1l1 3-1.4 1.3a8.5 8.5 0 0 0 4.3 4.3l1.3-1.4 3 1v2.1c0 .8-.7 1.4-1.5 1.3A12.6 12.6 0 0 1 3.9 5c-.1-.8.5-1.5 1.3-1.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function WhatsappIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.5 14.4c-.3-.1-1.7-.8-1.9-.9-.3-.1-.4-.1-.6.1-.2.3-.7.9-.8 1-.2.2-.3.2-.5.1-.3-.1-1.2-.4-2.3-1.4-.8-.7-1.4-1.7-1.6-1.9-.2-.3 0-.4.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.2-.4.1-.2 0-.3 0-.5 0-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.2.3-.9.9-.9 2.2s1 2.5 1.1 2.7c.1.2 2 3 4.8 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.5-.3Z" />
      <path d="M12 2.5A9.5 9.5 0 0 0 3.6 17L2.5 21.5l4.6-1.2A9.5 9.5 0 1 0 12 2.5Zm0 1.7a7.8 7.8 0 0 1 6.6 12 7.8 7.8 0 0 1-11.9 2.2l-.3-.2-2.7.7.7-2.6-.2-.3A7.8 7.8 0 0 1 12 4.2Z" />
    </svg>
  );
}

export function EyeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function ImageIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="16" height="13" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="7" cy="8" r="1.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 14.5 7.3 10.3a1.4 1.4 0 0 1 2 0L11 12l1.6-1.6a1.4 1.4 0 0 1 2 0L17.5 13.3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function VideoIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="4.5" width="11" height="11" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13.5 8.3 18 6v8l-4.5-2.3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function DocumentIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M5 2.5h6.3L15 6.2V17a.6.6 0 0 1-.6.6H5a.6.6 0 0 1-.6-.6V3.1a.6.6 0 0 1 .6-.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M11.3 2.5V6h3.7" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6.5 10.5h5M6.5 13h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function UploadIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 13V3.5M6.5 6.8 10 3.3l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 13.5V16a.9.9 0 0 0 .9.9h11.2a.9.9 0 0 0 .9-.9v-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function FacebookIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.5 21v-7.5h2.5l.4-3H13.5V8.4c0-.9.2-1.5 1.5-1.5h1.6V4.3C16.3 4.2 15.3 4 14.1 4c-2.4 0-4 1.5-4 4.1V10.5H7.6v3H10V21h3.5Z" />
    </svg>
  );
}

export function InstagramIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 7.2A4.8 4.8 0 1 0 12 16.8 4.8 4.8 0 0 0 12 7.2Zm0 7.9A3.1 3.1 0 1 1 12 8.9a3.1 3.1 0 0 1 0 6.2Z" />
      <path d="M17.5 2.5h-11A4 4 0 0 0 2.5 6.5v11a4 4 0 0 0 4 4h11a4 4 0 0 0 4-4v-11a4 4 0 0 0-4-4Zm2.3 15a2.3 2.3 0 0 1-2.3 2.3h-11A2.3 2.3 0 0 1 4.2 17.5v-11A2.3 2.3 0 0 1 6.5 4.2h11a2.3 2.3 0 0 1 2.3 2.3v11Z" />
      <circle cx="17.4" cy="6.6" r="1.1" />
    </svg>
  );
}

export function HomeIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.5 9.2 10 3.5l6.5 5.7V16a.9.9 0 0 1-.9.9H4.4a.9.9 0 0 1-.9-.9V9.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 16.9v-4.5h4v4.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function ListingsIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="3.5" width="14" height="13" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 8h8M6 11h8M6 14h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function InboxIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.5 6.2 10 2.8l6.5 3.4v8.5a1.3 1.3 0 0 1-1.3 1.3H4.8a1.3 1.3 0 0 1-1.3-1.3V6.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M3.8 11.5h3.2l1.2 1.8h3.6l1.2-1.8h3.2" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function ShieldIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M10 2.5 16 5v4.2c0 3.8-2.5 6.4-6 7.8-3.5-1.4-6-4-6-7.8V5l6-2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7.8 10.1 9.3 11.6l3-3.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SettingsIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M10 2.8v1.6M10 15.6v1.6M2.8 10h1.6M15.6 10h1.6M4.9 4.9l1.1 1.1M14 14l1.1 1.1M15.1 4.9 14 6M6 14l-1.1 1.1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function UsersIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="7.2" cy="7" r="2.3" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="13.5" cy="8" r="1.8" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.8 15.5c.4-2.2 2.1-3.5 4.4-3.5s4 1.3 4.4 3.5M12 12.2c1.7.1 3 .9 3.5 2.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function MapCheckIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.5 5.2 8 3.5l4 1.7 4.5-1.7V14.8L12 16.5l-4-1.7-4.5 1.7V5.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 3.5v11.3M12 5.2v11.3" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function FolderIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 5.2A1.2 1.2 0 0 1 4.2 4h4l1.4 1.6H15.8A1.2 1.2 0 0 1 17 6.8v7.8a1.2 1.2 0 0 1-1.2 1.2H4.2A1.2 1.2 0 0 1 3 14.6V5.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function MessageIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.5 5.2A1.7 1.7 0 0 1 5.2 3.5h9.6A1.7 1.7 0 0 1 16.5 5.2v7.2a1.7 1.7 0 0 1-1.7 1.7H8.2L4 16.5v-2.4H5.2A1.7 1.7 0 0 1 3.5 12.4V5.2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function HardDriveIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="14" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 11.5h14" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="13.5" cy="14.2" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function MonitorIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2.5" y="3.5" width="15" height="10" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M7 16.5h6M10 13.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="7" cy="8.2" r="1.1" stroke="currentColor" strokeWidth="1.2" />
      <path d="M9.2 8.2h5.3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function ReceiptIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5.5 2.75h9A1.75 1.75 0 0 1 16.25 4.5v12.1l-1.6-.9-1.5.9-1.5-.9-1.5.9-1.5-.9-1.5.9-1.6-.9V4.5A1.75 1.75 0 0 1 5.5 2.75Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M7.5 6.5h5M7.5 9.25h5M7.5 12h3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function InvestPartnershipIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 3.5v13M3.5 10h13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path
        d="M10 10 L14.2 6.2 A4.6 4.6 0 0 1 10 3.5Z"
        fill="currentColor"
        fillOpacity="0.25"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HardHatIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3.5 12.5h13v1.75A1.75 1.75 0 0 1 14.75 16h-9.5A1.75 1.75 0 0 1 3.5 14.25V12.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M4.25 12.25v-.5a5.75 5.75 0 0 1 11.5 0v.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <path d="M10 3.5v2.25M8.25 6.75h3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function WalletIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1" />
      <path d="M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3" />
      <path d="M20 9h-5a2.5 2.5 0 0 0 0 5h5a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1z" />
      <circle cx="15.5" cy="11.5" r="0.6" fill="currentColor" />
    </svg>
  );
}
