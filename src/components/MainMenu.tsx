import React, { useMemo, useState } from "react";
import {
  NICKNAME_RULE_HINT,
  loadSavedNickname,
  validateNickname,
} from "../utils/nickname";
import { Instructions } from "./Instructions";

export interface MainMenuProps {
  onPlayLocal: () => void;
  onPlayOnline: (nickname: string) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onPlayLocal,
  onPlayOnline,
}) => {
  const [nickname, setNickname] = useState(() => loadSavedNickname() ?? "");
  const [touched, setTouched] = useState(false);

  const validation = useMemo(() => validateNickname(nickname), [nickname]);
  const isValid = validation.isValid;
  const sanitized = validation.sanitized;
  const errorMessage = touched && !isValid ? validation.errors[0] : null;

  return (
    <div className="h-full overflow-y-auto p-3 md:p-6">
      <div className="mx-auto max-w-3xl grid gap-3 md:grid-cols-[320px_1fr] items-start">
        <section className="panel">
          <h2 className="panel-title">Play</h2>
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
                  if (e.key === "Enter" && isValid) onPlayOnline(sanitized);
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

            <button
              onClick={() => {
                setTouched(true);
                if (isValid) onPlayOnline(sanitized);
              }}
              disabled={!isValid}
              className="btn-primary w-full flex-col py-2"
            >
              <span className="text-base">Play Online</span>
              <span className="text-xs font-normal opacity-90">
                Find a random opponent
              </span>
            </button>

            <button onClick={onPlayLocal} className="btn w-full flex-col py-1.5">
              <span>Play Local</span>
              <span className="text-xs text-muted">Two players, one screen</span>
            </button>
          </div>
        </section>

        <section className="panel">
          <Instructions />
        </section>
      </div>
    </div>
  );
};
