import React, { useMemo, useState } from "react";
import {
  NICKNAME_RULE_HINT,
  loadSavedNickname,
  validateNickname,
} from "../utils/nickname";
import { Instructions } from "./Instructions";
import { BOT_LEVELS, type BotLevel } from "../lib/bot";

export interface MainMenuProps {
  onPlayLocal: () => void;
  onPlayOnline: (nickname: string) => void;
  onPlayFriend: (nickname: string) => Promise<void>;
  onPlayBot: (level: BotLevel) => void;
  invite?: {
    onJoin: (nickname: string) => Promise<void>;
    onDismiss: () => void;
  };
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onPlayLocal,
  onPlayOnline,
  onPlayFriend,
  onPlayBot,
  invite,
}) => {
  const [nickname, setNickname] = useState(() => loadSavedNickname() ?? "");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const validation = useMemo(() => validateNickname(nickname), [nickname]);
  const isValid = validation.isValid;
  const sanitized = validation.sanitized;
  const errorMessage = touched && !isValid ? validation.errors[0] : null;

  const run = async (action: (name: string) => Promise<void>) => {
    setTouched(true);
    if (!isValid || busy) return;
    setBusy(true);
    setRequestError(null);
    try {
      await action(sanitized);
    } catch (err) {
      setRequestError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  };

  const primary = invite
    ? () => run(invite.onJoin)
    : () => {
        setTouched(true);
        if (isValid) onPlayOnline(sanitized);
      };

  return (
    <div className="h-full overflow-y-auto p-3 md:p-6">
      <div className="mx-auto max-w-3xl grid gap-3 md:grid-cols-[320px_1fr] items-start">
        <section className="panel">
          <h2 className="panel-title">{invite ? "You're invited" : "Play"}</h2>
          <div className="p-3 space-y-3">

            <div>
              <label htmlFor="nickname" className="block text-xs font-bold mb-1">
                Your nickname
              </label>
              <input
                type="text"
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                onBlur={() => setTouched(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") primary();
                }}
                aria-invalid={!!errorMessage}
                aria-describedby="nickname-help"
                className={`field ${errorMessage ? "border-o" : ""}`}
                maxLength={20}
                autoComplete="off"
                spellCheck={false}
              />
              <p
                id="nickname-help"
                className={`mt-1 text-xs ${errorMessage ? "text-o" : "text-muted"}`}
              >
                {errorMessage ?? NICKNAME_RULE_HINT}
              </p>
            </div>

            {requestError && (
              <p role="alert" className="px-2 py-1.5 rounded border text-xs bg-o-soft border-o text-o">
                {requestError}
              </p>
            )}

            {invite ? (
              <div className="flex gap-2">
                <button onClick={primary} disabled={!isValid || busy} className="btn-primary flex-1 py-2">
                  {busy ? "Joining…" : "Join game"}
                </button>
                <button onClick={invite.onDismiss} className="btn">
                  Not now
                </button>
              </div>
            ) : (
              <>
                <button onClick={primary} disabled={!isValid} className="btn-primary w-full py-2 text-base">
                  Play Online
                </button>

                <button
                  onClick={() => run(onPlayFriend)}
                  disabled={!isValid || busy}
                  className="btn w-full py-1.5"
                >
                  {busy ? "Creating game…" : "Play a Friend"}
                </button>

                <button onClick={onPlayLocal} className="btn w-full py-1.5">
                  Play Local
                </button>

                <div>
                  <p className="text-xs font-bold mb-1">Play the computer</p>
                  <div className="grid grid-cols-2 gap-2">
                    {BOT_LEVELS.map((level) => (
                      <button key={level} onClick={() => onPlayBot(level)} className="btn capitalize">
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="panel">
          <Instructions />
        </section>
      </div>
    </div>
  );
};
