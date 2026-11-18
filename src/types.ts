export interface Deck {
  id: string;
  name: string;
  /** Langue de la face avant (BCP-47) pour la lecture audio, '' = aucune */
  frontLang: string;
  /** Langue de la face arrière (BCP-47) pour la lecture audio, '' = aucune */
  backLang: string;
  createdAt: number;
  updatedAt: number;
}

export interface Card {
  id: string;
  deckId: string;
  front: string;
  back: string;
  createdAt: number;
  /** Boîte de Leitner (0 = à apprendre) */
  box: number;
  /** Timestamp (ms) à partir duquel la carte est à réviser */
  due: number;
  reps: number;
  lapses: number;
}

/** Sens de révision : fb = avant→arrière, bf = arrière→avant, mix = aléatoire */
export type Dir = 'fb' | 'bf' | 'mix';

export interface ViewResult {
  el: HTMLElement;
  cleanup?: () => void;
}

export interface Backup {
  app: 'flashcards-pwa';
  version: 1;
  exportedAt: string;
  decks: Deck[];
  cards: Card[];
}
