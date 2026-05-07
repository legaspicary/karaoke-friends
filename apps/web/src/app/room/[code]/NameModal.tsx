"use client";

import { useState, useRef, useEffect } from "react";

interface NameModalProps {
  roomCode: string;
  initialName?: string;
  onSubmit: (name: string) => void;
}

export function NameModal({ roomCode, initialName = "", onSubmit }: NameModalProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync if initialName loads asynchronously (e.g. from sessionStorage effect)
  useEffect(() => {
    if (initialName && !name) {
      setName(initialName);
    }
  }, [initialName]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus the input on mount for keyboard users
  useEffect(() => {
    // Small rAF so the element is visible before we focus
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const handleSubmit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter your name to join.");
      inputRef.current?.focus();
      return;
    }
    if (trimmed.length > 30) {
      setError("Name must be 30 characters or fewer.");
      inputRef.current?.focus();
      return;
    }
    onSubmit(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="w-full max-w-sm mx-auto" role="main" aria-label="Join room">
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-6 text-center">
          <div className="text-4xl mb-2 select-none" aria-hidden="true">🎤</div>
          <h2 className="text-2xl font-extrabold text-white">
            Joining Room
          </h2>
          <p className="text-white/70 text-sm mt-1 font-mono tracking-widest">
            {roomCode}
          </p>
        </div>

        {/* Form */}
        <div className="px-8 py-8 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="modal-player-name"
              className="text-white/70 text-xs font-semibold uppercase tracking-wide"
            >
              What&apos;s your name?
            </label>
            <input
              ref={inputRef}
              id="modal-player-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError("");
              }}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Elvis"
              maxLength={30}
              aria-describedby={error ? "modal-name-error" : undefined}
              aria-invalid={error ? "true" : undefined}
              className="bg-white/8 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 focus-visible:ring-2 focus-visible:ring-purple-400 focus:border-purple-500/60 focus:bg-white/10 transition-colors text-sm outline-none"
            />
            {error && (
              <p id="modal-name-error" role="alert" className="text-red-400 text-xs">{error}</p>
            )}
          </div>

          <button
            onClick={handleSubmit}
            className="w-full py-3.5 rounded-xl text-base font-bold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-lg transition-all motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-purple-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent outline-none"
          >
            Join the Party
          </button>
        </div>
      </div>
    </div>
  );
}
