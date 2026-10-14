import React from "react";

interface InstructionsProps {
  showHeaderClose?: boolean;
  onClose?: () => void;
}

export const Instructions: React.FC<InstructionsProps> = React.memo(
  ({ showHeaderClose, onClose }) => {
    return (
      <div
        className="h-full flex flex-col"
        style={{ backgroundColor: "var(--surface)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <span
            className="text-xs font-bold tracking-widest uppercase"
            style={{ color: "var(--text-dim)" }}
          >
            How to Play
          </span>
          {showHeaderClose && (
            <button
              aria-label="Close"
              onClick={onClose}
              className="text-sm font-medium hover:opacity-70 transition-opacity"
              style={{ color: "var(--text-dim)" }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <Section title="Objective">
            <Rule>Win 3 sub-boards in a row (horizontal, vertical, or diagonal)</Rule>
            <Rule>Win a sub-board by getting 3 in a row inside it</Rule>
          </Section>

          <Section title="The Twist">
            <Rule>Your move sends the opponent to that cell's matching board</Rule>
            <Rule>If sent to a completed board, you can play anywhere</Rule>
          </Section>

          <Section title="Strategy">
            <Rule>Control where your opponent must play</Rule>
            <Rule>Force them into completed or bad boards</Rule>
            <Rule>Think 2–3 moves ahead</Rule>
          </Section>

          <Section title="Board Map">
            <div
              className="grid grid-cols-3 gap-1 text-xs font-mono rounded p-2 mt-1"
              style={{ backgroundColor: "var(--surface-2)" }}
            >
              {["UL", "U", "UR", "L", "M", "R", "LL", "Lo", "LR"].map((label) => (
                <div
                  key={label}
                  className="text-center py-1 rounded text-xs font-semibold"
                  style={{
                    backgroundColor: "var(--bg)",
                    color: "var(--text-dim)",
                    border: "1px solid var(--border)",
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </Section>
        </div>

      </div>
    );
  }
);

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <h4
        className="text-xs font-bold tracking-widest uppercase"
        style={{ color: "var(--text-dim)" }}
      >
        {title}
      </h4>
      <ul className="space-y-1">{children}</ul>
    </div>
  );
}

function Rule({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span
        className="mt-0.5 shrink-0 font-bold"
        style={{ color: "var(--x)", fontSize: "0.6rem" }}
      >
        ▸
      </span>
      <span className="text-xs leading-relaxed" style={{ color: "var(--text)" }}>
        {children}
      </span>
    </li>
  );
}
