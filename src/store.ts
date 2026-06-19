import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type { BingoRound, MasterCard, BingoCard } from "./types";

interface BingoStore {
  masterCards: MasterCard[];
  rounds: BingoRound[];
  activeRoundId: string | null;
  addRound: (name: string) => void;
  deleteRound: (id: string) => void;
  updateRoundName: (id: string, newName: string) => void;
  normalizeRounds: () => void;
  setActiveRound: (id: string) => void;
  addMasterCard: (card: Omit<MasterCard, "id">) => void;
  deleteMasterCard: (cardId: string) => void;
  updateMasterCard: (cardId: string, updates: Partial<MasterCard>) => void;
  toggleDrawnNumber: (number: number) => void;
  undoDraw: () => void;
  redoDraw: () => void;
  clearDrawnNumbers: () => void;
}


// Logic to check win
function checkCardWin(
  numbers: number[],
  drawnNumbers: Set<number>,
  winCondition: BingoRound['winCondition']
): false | 'LINE' | 'COLUMN' | 'DIAGONAL' | 'FULL' {
  // Numbers is an array of 25. 5x5 grid.
  // We assume 0 is a free space, which is always considered "drawn" implicitly.
  const isMarked = (idx: number) => numbers[idx] === 0 || drawnNumbers.has(numbers[idx]);

  const rows = [0, 5, 10, 15, 20];
  const cols = [0, 1, 2, 3, 4];

  // Helper
  const checkLine = (indices: number[]) => indices.every(isMarked);

  // Rows
  if (winCondition === 'LINE') {
    for (let r of rows) {
      if (checkLine([r, r + 1, r + 2, r + 3, r + 4])) return 'LINE';
    }
  }

  // Columns
  if (winCondition === 'COLUMN') {
    for (let c of cols) {
      if (checkLine([c, c + 5, c + 10, c + 15, c + 20])) return 'COLUMN';
    }
  }

  // Diagonals
  if (winCondition === 'DIAGONAL') {
    if (checkLine([0, 6, 12, 18, 24])) return 'DIAGONAL';
    if (checkLine([4, 8, 12, 16, 20])) return 'DIAGONAL';
  }

  // Full Board
  if (winCondition === 'FULL' || winCondition === 'ANY') {
    let full = true;
    for (let i = 0; i < 25; i++) {
      if (!isMarked(i)) {
        full = false;
        break;
      }
    }
    if (full) return 'FULL';
  }

  return false;
}

function computeMarkedCount(numbers: number[], drawnNumbers: Set<number>) {
  return numbers.filter(n => n === 0 || drawnNumbers.has(n)).length;
}

export const getRoundCards = (masterCards: MasterCard[], round: BingoRound | undefined): BingoCard[] => {
  if (!round) return [];
  const drawnSet = new Set(round.drawnNumbers);
  return masterCards.map(c => ({
    ...c,
    isWinner: checkCardWin(c.numbers, drawnSet, round.winCondition),
    markedCount: computeMarkedCount(c.numbers, drawnSet) // Using computeMarkedCount (must be before or defined correctly)
  }));
};

export const useStore = create<BingoStore>()(
  persist(
    (set, get) => ({
      masterCards: [],
      rounds: Array.from({ length: 10 }).map((_, i) => ({
        id: uuidv4(),
        name: `RODADA ${String(i + 1).padStart(2, '0')}`,
        drawnNumbers: [],
        winCondition: 'FULL',
        createdAt: Date.now() + i
      })),
      activeRoundId: null,

      addRound: (name) => {
        const id = uuidv4();
        const newRound: BingoRound = {
          id,
          name,
          drawnNumbers: [],
          winCondition: 'FULL',
          createdAt: Date.now()
        };
        set((state) => ({
          rounds: [...state.rounds, newRound],
          activeRoundId: state.activeRoundId || id
        }));
      },

      deleteRound: (id) => {
        set((state) => {
          const newRounds = state.rounds.filter(r => r.id !== id);
          return {
            rounds: newRounds,
            activeRoundId: state.activeRoundId === id 
              ? (newRounds[0]?.id || null)
              : state.activeRoundId
          };
        });
      },

      updateRoundName: (id, newName) => {
        set((state) => ({
          rounds: state.rounds.map(r => r.id === id ? { ...r, name: newName } : r)
        }));
      },

      normalizeRounds: () => {
        // Obsolete if we want to keep custom names. We can just leave it as a no-op or only rename default-like ones.
        // Doing nothing to preserve custom names.
      },

      setActiveRound: (id) => {
        set({ activeRoundId: id });
      },

      addMasterCard: (cardData) => {
        set((state) => ({
          masterCards: [
            ...state.masterCards,
            { ...cardData, id: uuidv4() }
          ]
        }));
      },

      deleteMasterCard: (cardId) => {
        set((state) => ({
          masterCards: state.masterCards.filter(c => c.id !== cardId)
        }));
      },

      updateMasterCard: (cardId, updates) => {
        set((state) => ({
           masterCards: state.masterCards.map(c => 
             c.id === cardId ? { ...c, ...updates } : c
           )
        }));
      },

      toggleDrawnNumber: (number) => {
        set((state) => {
          const rounds = [...state.rounds];
          const rIndex = rounds.findIndex(r => r.id === state.activeRoundId);
          if (rIndex >= 0) {
            const round = rounds[rIndex];
            const drawnList = [...round.drawnNumbers];
            const existsIdx = drawnList.indexOf(number);
            
            if (existsIdx >= 0) {
              drawnList.splice(existsIdx, 1);
            } else {
              drawnList.push(number);
              round.undoneNumbers = []; // clear redo stack on new manual action
            }
            round.drawnNumbers = drawnList;
          }
          return { rounds };
        });
      },

      undoDraw: () => {
        set((state) => {
          const rounds = [...state.rounds];
          const rIndex = rounds.findIndex(r => r.id === state.activeRoundId);
          if (rIndex >= 0) {
            const round = rounds[rIndex];
            if (round.drawnNumbers.length > 0) {
              const lastNum = round.drawnNumbers[round.drawnNumbers.length - 1];
              round.drawnNumbers = round.drawnNumbers.slice(0, -1);
              const newUndone = round.undoneNumbers ? [...round.undoneNumbers] : [];
              newUndone.push(lastNum);
              round.undoneNumbers = newUndone;
            }
          }
          return { rounds };
        });
      },

      redoDraw: () => {
        set((state) => {
          const rounds = [...state.rounds];
          const rIndex = rounds.findIndex(r => r.id === state.activeRoundId);
          if (rIndex >= 0) {
            const round = rounds[rIndex];
            if (round.undoneNumbers && round.undoneNumbers.length > 0) {
              const num = round.undoneNumbers.pop()!;
              round.drawnNumbers = [...round.drawnNumbers, num];
            }
          }
          return { rounds };
        });
      },

      clearDrawnNumbers: () => {
        set((state) => {
          const rounds = [...state.rounds];
          const rIndex = rounds.findIndex(r => r.id === state.activeRoundId);
          if (rIndex >= 0) {
            const round = rounds[rIndex];
            round.drawnNumbers = [];
            round.undoneNumbers = [];
          }
           return { rounds };
        });
      }
    }),

    {
      name: "bingo-storage",
      version: 2,
      migrate: (persistedState: any, version: number) => {
        let state = persistedState;
        
        if (version === 0 || version === 1) {
           // v1 to v2 migration
           state.masterCards = state.masterCards || [];
           
           if (state.rounds && Array.isArray(state.rounds)) {
             for (const r of state.rounds) {
               r.winCondition = 'FULL'; // enforce FULL win condition
               
               if (r.cards && Array.isArray(r.cards)) {
                  // Transfer unique cards to masterCards collection
                  for (const c of r.cards) {
                     if (!state.masterCards.some((mc: any) => mc.id === c.id)) {
                        // Fix formatting for legacy names
                        let finalName = c.name;
                        if (/^Cartela\s+(\d+)$/i.test(finalName)) {
                          finalName = finalName.replace(/^Cartela\s+(\d+)$/i, "$1ª CARTELA");
                        }
                        state.masterCards.push({
                           id: c.id,
                           name: finalName,
                           cardNumber: c.cardNumber,
                           numbers: c.numbers
                        });
                     }
                  }
                  delete r.cards;
               }
             }
           }
        }
        return state as any;
      }
    }
  )
);
