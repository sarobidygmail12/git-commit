import type { ChangeCounts } from "../core/git/status.js";
import type { CommandUi } from "./command.js";

export type Suggestion = {
  label: string;
  description: string;
  completion: string;
  needsArgs: boolean;
};

export type SuggestionList = { kind: "none" | "command" | "argument"; items: readonly Suggestion[] };

export const NO_SUGGESTIONS: SuggestionList = { kind: "none", items: [] };

export type HeaderState = {
  branch: string;
  changes: ChangeCounts;
};

export interface ReplSession {
  execute(line: string): Promise<void>;
  suggest(input: string): Promise<SuggestionList>;
  readHeader(): Promise<HeaderState | undefined>;
}

/** L'UI Ink crée sa session avec son propre pont d'affichage ; le container fournit tout le reste. */
export type SessionFactory = (ui: CommandUi, onGitCommand: (line: string) => void, exit: () => void) => ReplSession;
