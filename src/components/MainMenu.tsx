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
    <div className="h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Super Tic-Tac-Toe
          </h1>
          <p className="text-gray-600">
            The ultimate strategy game combining classic tic-tac-toe with
            meta-gameplay
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="nickname"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Your Nickname
            </label>
            <input
              type="text"
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onBlur={() => setTouched(true)}
              placeholder="Enter your nickname..."
              aria-invalid={!!errorMessage}
              aria-describedby="nickname-help"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              maxLength={20}
            />
            <p id="nickname-help" className="mt-1 text-xs text-gray-500">
              {getNicknameRuleHint()}
            </p>
            {errorMessage && (
              <p className="mt-1 text-sm text-red-600">{errorMessage}</p>
            )}
          </div>

          <button
            onClick={() => {
              setTouched(true);
              const result = validateNickname(nickname);
              if (!result.isValid) return;
              onPlayOnline(result.sanitized);
            }}
            disabled={!isValid}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 transition-colors font-medium text-lg"
          >
            🌐 Play Online
          </button>

          <button
            onClick={onPlayLocal}
            className="w-full bg-gray-600 text-white py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors font-medium text-lg"
          >
            👥 Play Local
          </button>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>Online: Play against players worldwide</p>
          <p>Local: Play with a friend on this device</p>
        </div>
      </div>
    </div>
  );
};
