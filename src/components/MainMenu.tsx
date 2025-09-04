import React, { useState } from "react";

export interface MainMenuProps {
  onPlayLocal: () => void;
  onPlayOnline: (nickname: string) => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  onPlayLocal,
  onPlayOnline,
}) => {
  const [nickname, setNickname] = useState("");
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
              placeholder="Enter your nickname..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              maxLength={20}
            />
          </div>

          <button
            onClick={() => onPlayOnline(nickname.trim() || "Anonymous")}
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
