// Bingo 75 core types

export interface MasterCard {
  id: string;
  name: string;
  cardNumber?: string;
  numbers: number[]; // Array of 25 numbers. 0 = FREE space usually in index 12 (3rd row, 3rd col)
}

export interface BingoCard extends MasterCard {
  isWinner: false | 'LINE' | 'COLUMN' | 'DIAGONAL' | 'FULL' | 'LINE_AND_COLUMN';
  markedCount: number;
  hasLine: boolean;
  hasColumn: boolean;
  hasFull: boolean;
}

export interface BingoRound {
  id: string;
  name: string;
  drawnNumbers: number[]; // From 1 to 75
  undoneNumbers?: number[]; // For undo/redo
  winCondition: 'LINE' | 'COLUMN' | 'DIAGONAL' | 'FULL' | 'ANY';
  createdAt: number;
}

