"use client";

import { Bot, MessageCircle, Send, Sparkles, UserRound, X } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { SpawnNpcSpecies } from "./game-engine";

export type ChatMessage = {
  id: number;
  author: "you" | "chrono" | "system";
  text: string;
  tone?: "unlock";
};

type ChatPanelProps = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  onClose: () => void;
  canSpawnNpcs: boolean;
  onSpawnNpc: (species: SpawnNpcSpecies) => void;
};

const AUTHOR_LABEL: Record<ChatMessage["author"], string> = {
  you: "YOU",
  chrono: "CHRONO",
  system: "SYSTEM",
};

export default function ChatPanel({ messages, onSend, onClose, canSpawnNpcs, onSpawnNpc }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, []);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  }

  return (
    <aside className="chat-panel" role="dialog" aria-label="Field comms chat" onPointerDown={(event) => event.stopPropagation()}>
      <header className="chat-header">
        <span className="chat-header-icon"><MessageCircle size={14} /></span>
        <div>
          <strong>FIELD COMMS</strong>
          <small>CHANNEL 07 · LIZARD TOWN RELAY</small>
        </div>
        <button type="button" className="chat-close" onClick={onClose} aria-label="Close chat"><X size={15} /></button>
      </header>
      <div className="chat-log" ref={logRef} aria-live="polite">
        {messages.map((message) => (
          <p key={message.id} className={`chat-line chat-${message.author}${message.tone ? ` chat-tone-${message.tone}` : ""}`}>
            <b>{AUTHOR_LABEL[message.author]}</b>
            <span>{message.text}</span>
          </p>
        ))}
      </div>
      {canSpawnNpcs && (
        <div className="npc-spawner-dock">
          <div className="npc-spawner-heading"><Sparkles size={11} /> NPC SYNTHESIZER <span>READY</span></div>
          <div className="npc-spawner-buttons">
            <button type="button" onClick={() => onSpawnNpc("human")}><UserRound size={14} /><span>HUMAN</span></button>
            <button type="button" onClick={() => onSpawnNpc("robot")}><Bot size={14} /><span>ROBOT</span></button>
            <button type="button" onClick={() => onSpawnNpc("alien")}><span className="npc-alien-icon">✳</span><span>ALIEN</span></button>
          </div>
        </div>
      )}
      <form className="chat-form" onSubmit={submit}>
        <input
          ref={inputRef}
          value={draft}
          maxLength={160}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Type a message…"
          aria-label="Chat message"
          autoComplete="off"
          spellCheck={false}
        />
        <button type="submit" aria-label="Send message" disabled={!draft.trim()}><Send size={14} /></button>
      </form>
      <footer className="chat-footer"><kbd>ENTER</kbd> send <i>·</i> <kbd>ESC</kbd> close</footer>
    </aside>
  );
}
