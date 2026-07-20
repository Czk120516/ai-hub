"use client";

import { useState } from "react";
import { CAPABILITIES } from "@/lib/capabilities";
import type { Capability } from "@/lib/types";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/contexts/AuthContext";
import AuthGuard from "@/components/auth/AuthGuard";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import ChatPanel from "@/components/ChatPanel";
import InputArea from "@/components/InputArea";
import { AlertCircle } from "lucide-react";

function MainApp() {
  const { user, signOut } = useAuth();
  const [capability, setCapability] = useState<Capability>(CAPABILITIES[0]);
  const [draft, setDraft] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { messages, isStreaming, streamingId, error, send, stop, clear } =
    useChat(capability);

  const handleSelect = (cap: Capability) => {
    if (cap.id === capability.id) return;
    setCapability(cap);
    setDraft("");
  };

  const handleExample = (text: string) => {
    setDraft(text);
  };

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-slate-50">
      <Sidebar
        activeId={capability.id}
        onSelect={handleSelect}
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          capability={capability}
          onClear={clear}
          canClear={messages.length > 0}
          isStreaming={isStreaming}
          onMenuOpen={() => setMobileMenuOpen(true)}
          userEmail={user?.email ?? undefined}
          userName={user?.nickname}
          onSignOut={signOut}
        />

        <main className="min-h-0 flex-1">
          <ChatPanel
            messages={messages}
            streamingId={streamingId}
            capability={capability}
            onExample={handleExample}
          />
        </main>

        {error && (
          <div className="mx-auto w-full max-w-3xl px-3 sm:px-4">
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 sm:text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="break-all">{error}</span>
            </div>
          </div>
        )}

        <InputArea
          placeholder={capability.placeholder}
          isStreaming={isStreaming}
          onSend={send}
          onStop={stop}
          draft={draft}
          onDraftChange={setDraft}
        />
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <AuthGuard>
      <MainApp />
    </AuthGuard>
  );
}
