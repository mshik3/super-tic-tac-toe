import React from "react";

interface InstructionsProps {
  onNewGame?: () => void;
}

export const Instructions: React.FC<InstructionsProps> = React.memo(
  ({ onNewGame }) => {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">How to Play</h3>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm text-gray-700">
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">Basic Rules</h4>
            <ul className="space-y-1 text-xs">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2 mt-0.5">•</span>
                <span>9 smaller tic-tac-toe boards in a 3×3 grid</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2 mt-0.5">•</span>
                <span>Win 3 smaller boards in a row to win the game</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2 mt-0.5">•</span>
                <span>Your move determines opponent's next board</span>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">Strategy</h4>
            <ul className="space-y-1 text-xs">
              <li className="flex items-start">
                <span className="text-green-600 mr-2 mt-0.5">•</span>
                <span>Control where your opponent plays next</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2 mt-0.5">•</span>
                <span>Force opponent into completed boards</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-600 mr-2 mt-0.5">•</span>
                <span>Think multiple moves ahead</span>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">Board Layout</h4>
            <div className="grid grid-cols-3 gap-1 text-xs font-mono bg-gray-100 p-2 rounded">
              <div className="bg-white p-1 text-center">UL</div>
              <div className="bg-white p-1 text-center">U</div>
              <div className="bg-white p-1 text-center">UR</div>
              <div className="bg-white p-1 text-center">L</div>
              <div className="bg-white p-1 text-center">M</div>
              <div className="bg-white p-1 text-center">R</div>
              <div className="bg-white p-1 text-center">LL</div>
              <div className="bg-white p-1 text-center">Lo</div>
              <div className="bg-white p-1 text-center">LR</div>
            </div>
            <p className="text-xs text-gray-600">
              Each board has the same layout for individual cells
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-gray-900">Special Cases</h4>
            <ul className="space-y-1 text-xs">
              <li className="flex items-start">
                <span className="text-orange-600 mr-2 mt-0.5">•</span>
                <span>Sent to completed board? Play anywhere!</span>
              </li>
              <li className="flex items-start">
                <span className="text-orange-600 mr-2 mt-0.5">•</span>
                <span>First move can be on any board</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 p-4">
          <div className="flex space-x-2">
            <button
              onClick={onNewGame}
              className="flex-1 px-3 py-2 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              New Game
            </button>
          </div>
        </div>
      </div>
    );
  }
);
