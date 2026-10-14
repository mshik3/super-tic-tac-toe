import React from "react";
import { BOARD_NOTATION } from "../utils/chessNotation";

interface InstructionsProps {
  showHeaderClose?: boolean;
  onClose?: () => void;
}

export const Instructions: React.FC<InstructionsProps> = React.memo(
  ({ showHeaderClose, onClose }) => (
    <div className="h-full flex flex-col bg-panel">
      <div className="panel-title flex items-center justify-between">
        <span>How to play</span>
        {showHeaderClose && (
          <button aria-label="Close" onClick={onClose} className="btn px-2 py-0">
            ✕
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs leading-relaxed">
        <blockquote className="space-y-2 border-l-2 border-line-strong pl-3">
          <p>Each turn, you mark one of the small squares.</p>
          <p>When you get three in a row on a small board, you’ve won that board.</p>
          <p>To win the game, you need to win three small boards in a row.</p>
          <p>
            You don’t get to pick which of the nine boards to play on. That’s determined by
            your opponent’s previous move. Whichever square he picks, that’s the board you
            must play in next. (And whichever square you pick will determine which board he
            plays on next.)
          </p>
          <p>
            What if my opponent sends me to a board that’s already been won? In that case,
            congratulations – you get to go anywhere you like, on any of the other boards.
            (This means you should avoid sending your opponent to an already-won board!)
          </p>
          <footer className="text-muted">
            — Ben Orlin,{" "}
            <a
              href="https://mathwithbaddrawings.com/2013/06/16/ultimate-tic-tac-toe/"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-ink"
            >
              Math with Bad Drawings
            </a>
            , 2013
          </footer>
        </blockquote>

        <Section title="Notation">
          <div className="grid grid-cols-3 w-36 gap-px bg-line border border-line font-mono text-center">
            {Object.values(BOARD_NOTATION).map((label) => (
              <div key={label} className="bg-well py-0.5">
                {label}
              </div>
            ))}
          </div>
          <p className="text-muted mt-1">
            Move log: board in capitals, then cell. <span className="font-mono text-ink">Rm</span> =
            right board, middle square.
          </p>
        </Section>
      </div>
    </div>
  )
);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-bold mb-1">{title}</h3>
      {children}
    </div>
  );
}
