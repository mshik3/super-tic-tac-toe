import React, { useMemo, useState } from "react";
import { getNicknameRuleHint, validateNickname } from "../utils/nickname";

export interface MainMenuProps {
  onPlayLocal: () => void;
  onPlayOnline: (nickname: string) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onPlayLocal,
  onPlayOnline,
}) => {
  const [nickname, setNickname] = useState("");
  const [touched, setTouched] = useState(false);

  const validation = useMemo(() => validateNickname(nickname), [nickname]);
  const isValid = validation.isValid;
  const sanitized = validation.sanitized;
  const errorMessage = touched && !isValid ? validation.errors[0] : null;

  return (
    <div
      className="h-screen flex items-center justify-center bg-grid overflow-hidden relative"
      style={{ backgroundColor: "var(--bg)" }}
    >
      {/* Decorative glow blobs */}
      <div
        className="absolute top-0 left-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(0,204,255,0.04) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />
      <div
        className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background:
            "radial-gradient(circle, rgba(255,68,68,0.04) 0%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <div className="w-full max-w-sm mx-4 relative z-10 animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <span
              className="text-4xl font-bold select-none"
              style={{ color: "var(--x)" }}
            >
              X
            </span>
            <div
              className="h-px flex-1 max-w-12"
              style={{ backgroundColor: "var(--border-2)" }}
            />
            <span
              className="text-4xl font-bold select-none"
              style={{ color: "var(--o)" }}
            >
              O
            </span>
          </div>

          <h1
            className="font-bold tracking-widest leading-none uppercase"
            style={{ color: "var(--text)", fontSize: "clamp(2rem, 8vw, 2.8rem)" }}
          >
            Super
          </h1>
          <h2
            className="font-bold tracking-tight leading-none uppercase"
            style={{
              color: "var(--text-dim)",
              fontSize: "clamp(0.85rem, 3vw, 1.1rem)",
              letterSpacing: "0.3em",
            }}
          >
            Tic · Tac · Toe
          </h2>

          <p
            className="mt-3 text-xs font-medium tracking-wide"
            style={{ color: "var(--text-dim)" }}
          >
            Online multiplayer strategy
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-xl border overflow-hidden"
          style={{
            backgroundColor: "var(--surface)",
            borderColor: "var(--border-2)",
          }}
        >
          {/* Nickname section */}
          <div
            className="px-6 py-5 border-b"
            style={{ borderColor: "var(--border)" }}
          >
            <label
              htmlFor="nickname"
              className="block text-xs font-bold tracking-widest uppercase mb-2"
              style={{ color: "var(--text-dim)" }}
            >
              Your Nickname
            </label>
            <input
              type="text"
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onBlur={() => setTouched(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && isValid) {
                  onPlayOnline(sanitized);
                }
              }}
              placeholder="Enter nickname…"
              aria-invalid={!!errorMessage}
              aria-describedby="nickname-help"
              className="w-full px-3 py-2.5 rounded text-base font-semibold tracking-wide outline-none transition-all duration-150"
              style={{
                backgroundColor: "var(--surface-2)",
                border: errorMessage
                  ? "1px solid rgba(255,68,68,0.5)"
                  : "1px solid var(--border-2)",
                color: "var(--text)",
                caretColor: "var(--x)",
              }}
              maxLength={20}
              autoComplete="off"
              spellCheck={false}
            />
            {errorMessage ? (
              <p
                className="mt-1.5 text-xs font-medium"
                style={{ color: "var(--o)" }}
              >
                {errorMessage}
              </p>
            ) : (
              <p
                id="nickname-help"
                className="mt-1.5 text-xs"
                style={{ color: "var(--text-dim)" }}
              >
                {getNicknameRuleHint()}
              </p>
            )}
          </div>

          {/* Buttons */}
          <div className="px-6 py-5 space-y-3">
            <button
              onClick={() => {
                setTouched(true);
                const result = validateNickname(nickname);
                if (!result.isValid) return;
                onPlayOnline(sanitized);
              }}
              disabled={!isValid}
              className="w-full py-3 rounded font-bold text-base tracking-widest uppercase transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: isValid
                  ? "rgba(0,204,255,0.14)"
                  : "var(--surface-2)",
                color: isValid ? "var(--x)" : "var(--text-dim)",
                border: isValid
                  ? "1px solid rgba(0,204,255,0.4)"
                  : "1px solid var(--border)",
                boxShadow: isValid ? "0 0 20px rgba(0,204,255,0.1)" : "none",
              }}
            >
              Play Online
            </button>

            <button
              onClick={onPlayLocal}
              className="w-full py-3 rounded font-semibold text-sm tracking-widest uppercase transition-opacity hover:opacity-70"
              style={{
                backgroundColor: "var(--surface-2)",
                color: "var(--text-dim)",
                border: "1px solid var(--border)",
              }}
            >
              Play Local
            </button>
          </div>
        </div>

        {/* Footer hint */}
        <div className="mt-4 text-center">
          <p
            className="text-xs"
            style={{ color: "var(--text-dim)" }}
          >
            Play Online — find a random opponent worldwide
          </p>
        </div>
      </div>
    </div>
  );
};
