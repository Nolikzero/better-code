import { Logo } from "./ui/logo";

export function AppLoadingScreen() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background select-none">
      <div
        className="fixed top-0 left-0 right-0 h-10"
        style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
      />
      <Logo className="w-6 h-6 text-zinc-400 dark:text-zinc-500 animate-[pulse-logo_1.5s_ease-in-out_infinite]" />
      <style>{`
        @keyframes pulse-logo {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
