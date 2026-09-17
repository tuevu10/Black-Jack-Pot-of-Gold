export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  id: string;
  suit: Suit;
  rank: Rank;
  isHidden: boolean;
}

export interface Hand {
  id: string;
  cards: Card[];
  bet: number;
  isStand: boolean;
  isDoubled: boolean;
  isFreeDoubled: boolean;
  isBusted: boolean;
  isBlackjack: boolean;
  isResolved: boolean;
  payout: number;
  isSplit: boolean;
  isFreeSplit: boolean;
}

export type GamePhase = 'betting' | 'dealing' | 'insurance' | 'player' | 'dealer_reveal' | 'dealer_play' | 'resolved';

export interface GameState {
  deck: Card[];
  playerHands: Hand[];
  activeHandIndex: number;
  dealerCards: Card[];
  phase: GamePhase;
  balance: number;
  currentBet: number;
  potOfGoldBet: number;
  freeBetTokens: number;
  insuranceBet: number;
  pogPayout: number; // what the POG bet paid out (0 if lost, >0 if won)
  stats: {
    wins: number;
    losses: number;
    pushes: number;
    blackjacks: number;
    pogWins: number;
  };
  message: string;
}

export const POG_PAYOUTS: Record<number, number> = {
  1: 3,
  2: 10,
  3: 30,
  4: 60,
  5: 100,
  6: 299,
  7: 1000,
};

export function getPogPayout(tokens: number): number {
  if (tokens <= 0) return 0;
  if (tokens >= 7) return POG_PAYOUTS[7];
  return POG_PAYOUTS[tokens] ?? 0;
}

export function createDeck(numDecks: number = 6): Card[] {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  const deck: Card[] = [];

  for (let i = 0; i < numDecks; i++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ id: Math.random().toString(36).substring(2), suit, rank, isHidden: false });
      }
    }
  }

  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

export function getHandValue(cards: Card[]) {
  let total = 0;
  let softAces = 0;
  for (const c of cards) {
    if (c.isHidden) continue;
    if (c.rank === 'A') {
      softAces++;
      total += 11;
    } else if (['J', 'Q', 'K'].includes(c.rank)) {
      total += 10;
    } else {
      total += parseInt(c.rank);
    }
  }
  while (total > 21 && softAces > 0) {
    total -= 10;
    softAces--;
  }
  return { total, isSoft: softAces > 0 };
}

export function isBlackjack(cards: Card[]) {
  return cards.length === 2 && getHandValue(cards).total === 21;
}

/** True if this pair qualifies for a FREE split (any pair except 10-value cards) */
export function isFreeEligibleSplit(rank: Rank): boolean {
  return !['10', 'J', 'Q', 'K'].includes(rank);
}

/** True if this two-card hand qualifies for a FREE double (hard 9, 10, or 11) */
export function isFreeEligibleDouble(cards: Card[]): boolean {
  const { total, isSoft } = getHandValue(cards);
  return !isSoft && (total === 9 || total === 10 || total === 11);
}

export const initialState: GameState = {
  deck: createDeck(),
  playerHands: [],
  activeHandIndex: 0,
  dealerCards: [],
  phase: 'betting',
  balance: 1000,
  currentBet: 0,
  potOfGoldBet: 0,
  freeBetTokens: 0,
  insuranceBet: 0,
  pogPayout: 0,
  stats: { wins: 0, losses: 0, pushes: 0, blackjacks: 0, pogWins: 0 },
  message: 'Place your bet to start.',
};

export type GameAction =
  | { type: 'PLACE_BET'; amount: number }
  | { type: 'CLEAR_BET' }
  | { type: 'PLACE_POG_BET'; amount: number }
  | { type: 'CLEAR_POG_BET' }
  | { type: 'DEAL' }
  | { type: 'HIT' }
  | { type: 'STAND' }
  | { type: 'DOUBLE' }
  | { type: 'SPLIT' }
  | { type: 'INSURANCE'; accept: boolean }
  | { type: 'REVEAL_DEALER' }
  | { type: 'DEALER_PLAY' }
  | { type: 'RESOLVE' }
  | { type: 'NEW_ROUND' };

function advanceHand(state: GameState): GameState {
  let nextActive = state.activeHandIndex;
  // Move past busted or stood hands
  while (nextActive < state.playerHands.length && state.playerHands[nextActive].isStand) {
    nextActive++;
  }
  if (nextActive >= state.playerHands.length) {
    return { ...state, activeHandIndex: Math.max(0, state.playerHands.length - 1), phase: 'dealer_reveal' };
  }
  return { ...state, activeHandIndex: nextActive };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'PLACE_BET': {
      if (state.currentBet + action.amount > 500) return state;
      if (state.balance < action.amount) return state;
      return {
        ...state,
        currentBet: state.currentBet + action.amount,
        balance: state.balance - action.amount,
      };
    }

    case 'CLEAR_BET': {
      return {
        ...state,
        balance: state.balance + state.currentBet,
        currentBet: 0,
      };
    }

    case 'PLACE_POG_BET': {
      const newTotal = state.potOfGoldBet + action.amount;
      if (newTotal > 25) return state; // Max $25 POG bet (typical casino limit)
      if (state.balance < action.amount) return state;
      return {
        ...state,
        potOfGoldBet: newTotal,
        balance: state.balance - action.amount,
      };
    }

    case 'CLEAR_POG_BET': {
      return {
        ...state,
        balance: state.balance + state.potOfGoldBet,
        potOfGoldBet: 0,
      };
    }

    case 'DEAL': {
      if (state.currentBet === 0) return state;
      let newDeck = [...state.deck];
      if (newDeck.length < 78) newDeck = createDeck();

      const pCard1 = newDeck.pop()!;
      const dCard1 = newDeck.pop()!;
      const pCard2 = newDeck.pop()!;
      const dCard2 = { ...newDeck.pop()!, isHidden: true };

      const playerHand: Hand = {
        id: Math.random().toString(36).substring(2),
        cards: [pCard1, pCard2],
        bet: state.currentBet,
        isStand: false,
        isDoubled: false,
        isFreeDoubled: false,
        isBusted: false,
        isBlackjack: isBlackjack([pCard1, pCard2]),
        isResolved: false,
        payout: 0,
        isSplit: false,
        isFreeSplit: false,
      };

      let nextPhase: GamePhase = 'player';
      let message = 'Your turn.';

      if (dCard1.rank === 'A') {
        nextPhase = 'insurance';
        message = 'Insurance?';
      } else if (['10', 'J', 'Q', 'K'].includes(dCard1.rank) && isBlackjack([dCard1, { ...dCard2, isHidden: false }])) {
        dCard2.isHidden = false;
        nextPhase = 'resolved';
        message = 'Dealer Blackjack.';
      } else if (playerHand.isBlackjack) {
        nextPhase = 'resolved';
        message = 'Blackjack!';
      }

      return {
        ...state,
        deck: newDeck,
        playerHands: [playerHand],
        dealerCards: [dCard1, dCard2],
        phase: nextPhase,
        freeBetTokens: 0,
        pogPayout: 0,
        message,
      };
    }

    case 'INSURANCE': {
      let newBalance = state.balance;
      let insBet = 0;
      if (action.accept) {
        insBet = Math.floor(state.currentBet / 2);
        newBalance -= insBet;
      }

      const dCards = [...state.dealerCards];
      let nextPhase: GamePhase = 'player';
      let msg = 'Your turn.';

      if (isBlackjack([dCards[0], { ...dCards[1], isHidden: false }])) {
        dCards[1] = { ...dCards[1], isHidden: false };
        nextPhase = 'resolved';
        msg = 'Dealer Blackjack.';
      } else {
        if (state.playerHands[0].isBlackjack) {
          nextPhase = 'resolved';
          msg = 'Blackjack!';
        }
      }

      return {
        ...state,
        balance: newBalance,
        insuranceBet: insBet,
        dealerCards: dCards,
        phase: nextPhase,
        message: msg,
      };
    }

    case 'HIT': {
      const newDeck = [...state.deck];
      const card = newDeck.pop()!;

      const newHands = [...state.playerHands];
      const hand = { ...newHands[state.activeHandIndex] };
      hand.cards = [...hand.cards, card];

      const val = getHandValue(hand.cards);
      if (val.total > 21) {
        hand.isBusted = true;
        hand.isStand = true;
      } else if (val.total === 21) {
        hand.isStand = true;
      }

      newHands[state.activeHandIndex] = hand;
      return advanceHand({ ...state, deck: newDeck, playerHands: newHands });
    }

    case 'STAND': {
      const newHands = [...state.playerHands];
      newHands[state.activeHandIndex] = { ...newHands[state.activeHandIndex], isStand: true };
      return advanceHand({ ...state, playerHands: newHands });
    }

    case 'DOUBLE': {
      const newDeck = [...state.deck];
      const card = newDeck.pop()!;

      const newHands = [...state.playerHands];
      const hand = { ...newHands[state.activeHandIndex] };
      const isFree = isFreeEligibleDouble(hand.cards);

      hand.cards = [...hand.cards, card];
      hand.isDoubled = true;
      hand.isFreeDoubled = isFree;
      hand.isStand = true;

      let newBalance = state.balance;
      let newTokens = state.freeBetTokens;

      if (isFree) {
        // Free double: no extra charge, earn a token
        newTokens++;
      } else {
        // Paid double: deduct an additional bet equal to original
        const additional = hand.bet;
        hand.bet += additional;
        newBalance -= additional;
      }

      const val = getHandValue(hand.cards);
      if (val.total > 21) hand.isBusted = true;

      newHands[state.activeHandIndex] = hand;
      return advanceHand({
        ...state,
        deck: newDeck,
        playerHands: newHands,
        balance: newBalance,
        freeBetTokens: newTokens,
      });
    }

    case 'SPLIT': {
      const newHands = [...state.playerHands];
      const hand = newHands[state.activeHandIndex];

      const card1 = hand.cards[0];
      const card2 = hand.cards[1];
      const isFree = isFreeEligibleSplit(card1.rank);

      const newDeck = [...state.deck];

      const hand1: Hand = {
        ...hand,
        id: Math.random().toString(36).substring(2),
        cards: [card1, newDeck.pop()!],
        isStand: false,
        isBusted: false,
        isBlackjack: false,
        isResolved: false,
        payout: 0,
        isSplit: true,
        isFreeSplit: isFree,
      };

      const hand2: Hand = {
        ...hand,
        id: Math.random().toString(36).substring(2),
        cards: [card2, newDeck.pop()!],
        isStand: false,
        isBusted: false,
        isBlackjack: false,
        isResolved: false,
        payout: 0,
        isSplit: true,
        isFreeSplit: isFree,
      };

      // Aces: each hand gets exactly one card and stands
      if (card1.rank === 'A') {
        hand1.isStand = true;
        hand2.isStand = true;
      }

      let newBalance = state.balance;
      let newTokens = state.freeBetTokens;

      if (isFree) {
        // Free split: no extra charge, earn 1 token
        newTokens++;
      } else {
        // Paid split: deduct an extra bet
        newBalance -= hand.bet;
      }

      newHands.splice(state.activeHandIndex, 1, hand1, hand2);

      return advanceHand({
        ...state,
        deck: newDeck,
        playerHands: newHands,
        balance: newBalance,
        freeBetTokens: newTokens,
      });
    }

    case 'REVEAL_DEALER': {
      const dCards = state.dealerCards.map((c, i) => i === 1 ? { ...c, isHidden: false } : c);
      return { ...state, dealerCards: dCards, phase: 'dealer_play' };
    }

    case 'DEALER_PLAY': {
      const allBusted = state.playerHands.every(h => h.isBusted);
      const allBJ = state.playerHands.every(h => h.isBlackjack);
      if (allBusted || allBJ) {
        return { ...state, phase: 'resolved' };
      }

      const dVal = getHandValue(state.dealerCards);
      // Dealer hits soft 17, hits anything under 17
      const shouldHit = dVal.total < 17 || (dVal.total === 17 && dVal.isSoft);

      if (shouldHit) {
        const newDeck = [...state.deck];
        const newCards = [...state.dealerCards, newDeck.pop()!];
        return { ...state, deck: newDeck, dealerCards: newCards };
      } else {
        return { ...state, phase: 'resolved' };
      }
    }

    case 'RESOLVE': {
      let { balance, stats, potOfGoldBet, freeBetTokens, insuranceBet } = state;
      const dVal = getHandValue(state.dealerCards);
      const dealerFinalTotal = dVal.total;
      const dealerHasBJ = isBlackjack(state.dealerCards);
      // Push 22: dealer busts with exactly 22 = push for all live hands
      const dealerPushOn22 = dealerFinalTotal === 22;
      // Normal bust: dealer busts with 23+ = player wins
      const dealerNormalBust = dealerFinalTotal > 22;

      let newStats = { ...stats };
      let pogPayout = 0;

      const resolvedHands = state.playerHands.map(hand => {
        let payout = 0;
        const pVal = getHandValue(hand.cards);

        if (hand.isBusted) {
          newStats.losses++;
        } else if (dealerHasBJ) {
          if (hand.isBlackjack) {
            payout = hand.bet; // push
            newStats.pushes++;
          } else {
            newStats.losses++;
          }
        } else if (hand.isBlackjack) {
          // Player BJ wins 3:2 (exempt from Push 22)
          payout = hand.bet + Math.floor(hand.bet * 1.5);
          newStats.blackjacks++;
          newStats.wins++;
        } else if (dealerPushOn22) {
          // Dealer busts with 22 → push (not a win)
          payout = hand.bet;
          newStats.pushes++;
        } else if (dealerNormalBust) {
          payout = hand.bet * 2;
          newStats.wins++;
        } else if (pVal.total > dealerFinalTotal) {
          payout = hand.bet * 2;
          newStats.wins++;
        } else if (pVal.total === dealerFinalTotal) {
          payout = hand.bet;
          newStats.pushes++;
        } else {
          newStats.losses++;
        }

        balance += payout;
        return { ...hand, isResolved: true, payout };
      });

      // Insurance payout
      if (dealerHasBJ && insuranceBet > 0) {
        balance += insuranceBet * 3; // 2:1 on insurance bet (return bet + 2x)
      } else if (!dealerHasBJ && insuranceBet > 0) {
        // Insurance loses (already deducted when placed)
      }

      // Pot of Gold side bet resolution
      // POG loses if dealer has blackjack; otherwise pays based on tokens
      if (potOfGoldBet > 0) {
        if (!dealerHasBJ && freeBetTokens > 0) {
          const multiplier = getPogPayout(freeBetTokens);
          pogPayout = potOfGoldBet * multiplier + potOfGoldBet; // winnings + return of bet
          balance += pogPayout;
          newStats.pogWins++;
        }
        // If 0 tokens or dealer BJ: POG bet is lost (already deducted when placed)
      }

      return {
        ...state,
        playerHands: resolvedHands,
        balance,
        stats: newStats,
        phase: 'resolved',
        pogPayout,
      };
    }

    case 'NEW_ROUND': {
      return {
        ...state,
        playerHands: [],
        dealerCards: [],
        phase: 'betting',
        currentBet: 0,
        potOfGoldBet: 0,
        freeBetTokens: 0,
        insuranceBet: 0,
        pogPayout: 0,
        message: 'Place your bet.',
        activeHandIndex: 0,
      };
    }

    default:
      return state;
  }
}

// ─── Strategy ─────────────────────────────────────────────────────────────────

export type ActionDecision = 'H' | 'S' | 'D' | 'P' | 'Rh' | 'Rs';

export const hardStrategyDisplay: Record<string, ActionDecision[]> = {
  '17+': ['S','S','S','S','S','S','S','S','S','S'],
  '16':  ['S','S','S','S','S','H','H','H','H','H'],
  '15':  ['S','S','S','S','S','H','H','H','H','H'],
  '14':  ['S','S','S','S','S','H','H','H','H','H'],
  '13':  ['S','S','S','S','S','H','H','H','H','H'],
  '12':  ['H','H','S','S','S','H','H','H','H','H'],
  '11':  ['D','D','D','D','D','D','D','D','D','H'],
  '10':  ['D','D','D','D','D','D','D','D','H','H'],
  '9':   ['H','D','D','D','D','H','H','H','H','H'],
  '8-':  ['H','H','H','H','H','H','H','H','H','H'],
};

export const softStrategyDisplay: Record<string, ActionDecision[]> = {
  '20': ['S','S','S','S','S','S','S','S','S','S'],
  '19': ['S','S','S','S','D','S','S','S','S','S'],
  '18': ['S','D','D','D','D','S','S','H','H','H'],
  '17': ['H','D','D','D','D','H','H','H','H','H'],
  '16': ['H','H','D','D','D','H','H','H','H','H'],
  '15': ['H','H','D','D','D','H','H','H','H','H'],
  '14': ['H','H','H','D','D','H','H','H','H','H'],
  '13': ['H','H','H','D','D','H','H','H','H','H'],
};

export const pairStrategyDisplay: Record<string, ActionDecision[]> = {
  'A':  ['P','P','P','P','P','P','P','P','P','P'],
  '10': ['S','S','S','S','S','S','S','S','S','S'],
  '9':  ['P','P','P','P','P','S','P','P','S','S'],
  '8':  ['P','P','P','P','P','P','P','P','P','P'],
  '7':  ['P','P','P','P','P','P','H','H','H','H'],
  '6':  ['P','P','P','P','P','H','H','H','H','H'],
  '5':  ['D','D','D','D','D','D','D','D','H','H'],
  '4':  ['H','H','H','P','P','H','H','H','H','H'],
  '3':  ['P','P','P','P','P','P','H','H','H','H'],
  '2':  ['P','P','P','P','P','P','H','H','H','H'],
};

const colIndex = (card: Card) => {
  if (!card) return 0;
  if (card.rank === 'A') return 9;
  if (['10', 'J', 'Q', 'K'].includes(card.rank)) return 8;
  return parseInt(card.rank) - 2;
};

export function getStrategyRecommendation(playerCards: Card[], dealerUpcard: Card): ActionDecision | null {
  if (!playerCards || !playerCards.length || !dealerUpcard) return null;
  const col = colIndex(dealerUpcard);
  const isTwoCards = playerCards.length === 2;

  let rec: ActionDecision;

  const isPair = isTwoCards && playerCards[0].rank === playerCards[1].rank;
  if (isPair) {
    const rank = playerCards[0].rank === 'A' ? 'A' : (['10', 'J', 'Q', 'K'].includes(playerCards[0].rank) ? '10' : playerCards[0].rank);
    rec = pairStrategyDisplay[rank][col];
  } else {
    const { total, isSoft } = getHandValue(playerCards);
    if (isSoft) {
      if (total >= 20) rec = softStrategyDisplay['20'][col];
      else rec = softStrategyDisplay[total.toString()]?.[col] || 'S';
    } else {
      if (total >= 17) rec = hardStrategyDisplay['17+'][col];
      else if (total <= 8) rec = hardStrategyDisplay['8-'][col];
      else rec = hardStrategyDisplay[total.toString()]?.[col] || 'H';
    }
  }

  if (!isTwoCards) {
    if (rec === 'D') {
      const { total, isSoft } = getHandValue(playerCards);
      if (isSoft && total >= 18) rec = 'S';
      else rec = 'H';
    }
    if (rec === 'Rh') rec = 'H';
    if (rec === 'Rs') rec = 'S';
    if (rec === 'P') rec = 'H';
  }

  return rec;
}
