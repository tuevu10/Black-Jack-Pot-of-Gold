import { useReducer, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardComponent } from './components/game/Card';
import { StrategyPanel } from './components/game/StrategyPanel';
import {
  gameReducer, initialState, getHandValue, isBlackjack,
  isFreeEligibleDouble, isFreeEligibleSplit,
  getPogPayout, POG_PAYOUTS, GameState
} from './lib/gameLogic';

// ─── Round explanation ────────────────────────────────────────────────────────
function buildExplanation(state: GameState): { lines: { text: string; color: string }[]; net: number } {
  const lines: { text: string; color: string }[] = [];
  const dVal = getHandValue(state.dealerCards);
  const dTotal = dVal.total;
  const dealerHasBJ = isBlackjack(state.dealerCards);
  const dealerPushOn22 = dTotal === 22;
  const dealerNormalBust = dTotal > 22;
  let net = 0;

  // Dealer summary line
  if (dealerHasBJ) {
    lines.push({ text: 'Dealer has Blackjack.', color: 'text-red-400' });
  } else if (dealerPushOn22) {
    lines.push({ text: 'Dealer busted with 22 → Push 22 rule applies (all live bets push).', color: 'text-yellow-400' });
  } else if (dealerNormalBust) {
    lines.push({ text: `Dealer busted with ${dTotal} → all live hands win.`, color: 'text-emerald-400' });
  } else {
    lines.push({ text: `Dealer stands on ${dTotal}.`, color: 'text-emerald-400/70' });
  }

  // Per-hand lines
  state.playerHands.forEach((hand, i) => {
    const pVal = getHandValue(hand.cards);
    const prefix = state.playerHands.length > 1 ? `Hand ${i + 1}: ` : '';

    if (hand.isBusted) {
      lines.push({ text: `${prefix}You busted (${pVal.total}) → lost $${hand.bet}.`, color: 'text-red-400' });
      net -= hand.bet;
    } else if (dealerHasBJ) {
      if (hand.isBlackjack) {
        lines.push({ text: `${prefix}Both Blackjack → push, $${hand.bet} returned.`, color: 'text-gray-400' });
      } else {
        lines.push({ text: `${prefix}Dealer Blackjack beats your ${pVal.total} → lost $${hand.bet}.`, color: 'text-red-400' });
        net -= hand.bet;
      }
    } else if (hand.isBlackjack) {
      const won = hand.payout - hand.bet;
      lines.push({ text: `${prefix}Blackjack pays 3:2 → won $${won}.`, color: 'text-yellow-300' });
      net += won;
    } else if (dealerPushOn22) {
      lines.push({ text: `${prefix}Your ${pVal.total} pushes on dealer 22 → $${hand.bet} returned.`, color: 'text-yellow-400' });
    } else if (dealerNormalBust) {
      lines.push({ text: `${prefix}Your ${pVal.total} wins vs. dealer bust → won $${hand.bet}.`, color: 'text-emerald-400' });
      net += hand.bet;
    } else if (pVal.total > dTotal) {
      lines.push({ text: `${prefix}Your ${pVal.total} beats dealer ${dTotal} → won $${hand.bet}.`, color: 'text-emerald-400' });
      net += hand.bet;
    } else if (pVal.total === dTotal) {
      lines.push({ text: `${prefix}Your ${pVal.total} ties dealer ${dTotal} → push, $${hand.bet} returned.`, color: 'text-gray-400' });
    } else {
      lines.push({ text: `${prefix}Your ${pVal.total} loses to dealer ${dTotal} → lost $${hand.bet}.`, color: 'text-red-400' });
      net -= hand.bet;
    }
  });

  // Insurance
  if (state.insuranceBet > 0) {
    if (dealerHasBJ) {
      const won = state.insuranceBet * 2;
      lines.push({ text: `Insurance pays 2:1 → won $${won}.`, color: 'text-emerald-400' });
      net += won;
    } else {
      lines.push({ text: `Insurance lost → -$${state.insuranceBet}.`, color: 'text-red-400' });
      net -= state.insuranceBet;
    }
  }

  // Pot of Gold
  if (state.potOfGoldBet > 0) {
    if (dealerHasBJ) {
      lines.push({ text: `Pot of Gold loses to dealer Blackjack → -$${state.potOfGoldBet}.`, color: 'text-red-400' });
      net -= state.potOfGoldBet;
    } else if (state.freeBetTokens === 0) {
      lines.push({ text: `Pot of Gold: no free bets taken → lost $${state.potOfGoldBet}.`, color: 'text-red-400' });
      net -= state.potOfGoldBet;
    } else {
      const mult = getPogPayout(state.freeBetTokens);
      const won = state.pogPayout - state.potOfGoldBet;
      lines.push({ text: `Pot of Gold: ${state.freeBetTokens} token${state.freeBetTokens !== 1 ? 's' : ''} × ${mult}:1 → won $${won}.`, color: 'text-yellow-300' });
      net += won;
    }
  }

  return { lines, net };
}
import { sounds } from './lib/audio';

// ─── Gold coin shower on win ────────────────────────────────────────────────
const CoinShower = () => {
  const coins = Array.from({ length: 40 });
  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {coins.map((_, i) => (
        <motion.div
          key={i}
          initial={{ y: -50, x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000), rotate: 0, opacity: 1 }}
          animate={{ y: (typeof window !== 'undefined' ? window.innerHeight : 800) + 50, rotate: 720, opacity: 0 }}
          transition={{ duration: 1.5 + Math.random() * 2, ease: 'easeIn', delay: Math.random() * 0.5 }}
          className="absolute w-7 h-7 rounded-full bg-gradient-to-br from-yellow-300 to-amber-600 border-2 border-yellow-200 shadow-[0_0_12px_rgba(251,191,36,0.8)] flex items-center justify-center"
        >
          <span className="text-[10px] text-amber-900 font-bold">$</span>
        </motion.div>
      ))}
    </div>
  );
};

// ─── Chip button ─────────────────────────────────────────────────────────────
const Chip = ({ amount, onClick, small }: { amount: number; onClick: () => void; small?: boolean }) => {
  const colors: Record<number, string> = {
    1:   'bg-gradient-to-br from-amber-100 to-amber-300 text-amber-900 border-amber-400',
    5:   'bg-gradient-to-br from-gray-300 to-gray-400 text-gray-800 border-gray-500',
    25:  'bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-950 border-amber-600',
    100: 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-emerald-950 border-emerald-700',
    500: 'bg-gradient-to-br from-purple-400 to-purple-700 text-purple-950 border-purple-800',
  };
  const sz = small ? 'w-10 h-10 text-xs border-[3px]' : 'w-13 h-13 text-sm border-4';
  return (
    <button
      onClick={onClick}
      className={`${sz} rounded-full flex items-center justify-center font-bold shadow-lg hover:-translate-y-1 transition-transform ${colors[amount]}`}
      style={small ? { width: 40, height: 40 } : { width: 52, height: 52 }}
    >
      ${amount}
    </button>
  );
};

// ─── Token (free bet lammer) display ─────────────────────────────────────────
const Token = ({ lit }: { lit: boolean }) => (
  <motion.div
    initial={{ scale: 0.3, opacity: 0 }}
    animate={{ scale: lit ? 1 : 0.75, opacity: lit ? 1 : 0.25 }}
    className={`w-7 h-7 rounded-full border-2 flex items-center justify-center font-bold text-xs
      ${lit
        ? 'bg-gradient-to-br from-yellow-300 to-amber-500 border-yellow-200 shadow-[0_0_10px_rgba(251,191,36,0.9)] text-amber-900'
        : 'bg-emerald-950 border-emerald-700 text-emerald-700'}`}
  >
    {lit ? '★' : '☆'}
  </motion.div>
);

// ─── Action button ─────────────────────────────────────────────────────────
const ActionBtn = ({
  onClick, disabled = false, className, children,
}: {
  onClick: () => void; disabled?: boolean; className: string; children: React.ReactNode;
}) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className={`rounded-full px-5 py-3 text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed transform active:scale-95 shadow-lg ${className}`}
  >
    {children}
  </button>
);

// ─── POG payout table (mini) ─────────────────────────────────────────────────
const PogPayTable = ({ tokens, bet }: { tokens: number; bet: number }) => (
  <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
    {Object.entries(POG_PAYOUTS).map(([t, mult]) => {
      const n = parseInt(t);
      const isActive = tokens === n || (n === 7 && tokens >= 7);
      return (
        <div key={t} className={`flex justify-between px-2 py-0.5 rounded ${isActive ? 'bg-amber-500/30 text-amber-300 font-bold' : 'text-emerald-400/60'}`}>
          <span>{n === 7 ? '7+' : n} token{n !== 1 ? 's' : ''}</span>
          <span>{mult}:1{isActive && bet > 0 ? ` = $${mult * bet}` : ''}</span>
        </div>
      );
    })}
  </div>
);

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const [showWin, setShowWin] = useState(false);
  const prevWins = useRef(state.stats.wins);
  const prevLosses = useRef(state.stats.losses);

  useEffect(() => {
    if (state.stats.wins > prevWins.current) {
      sounds.win();
      setShowWin(true);
      setTimeout(() => setShowWin(false), 3500);
    }
    prevWins.current = state.stats.wins;
  }, [state.stats.wins]);

  useEffect(() => {
    if (state.stats.losses > prevLosses.current) sounds.bust();
    prevLosses.current = state.stats.losses;
  }, [state.stats.losses]);

  useEffect(() => {
    if (state.phase === 'dealer_reveal') {
      const t = setTimeout(() => dispatch({ type: 'REVEAL_DEALER' }), 800);
      return () => clearTimeout(t);
    }
    if (state.phase === 'dealer_play') {
      const t = setTimeout(() => dispatch({ type: 'DEALER_PLAY' }), 800);
      return () => clearTimeout(t);
    }
    if (state.phase === 'resolved' && state.playerHands.length > 0 && !state.playerHands[0]?.isResolved) {
      const t = setTimeout(() => dispatch({ type: 'RESOLVE' }), 500);
      return () => clearTimeout(t);
    }
  }, [state.phase, state.dealerCards.length, state.playerHands]);

  const activeHand = state.playerHands[state.activeHandIndex];
  const canFreeSplit = activeHand
    && activeHand.cards.length === 2
    && activeHand.cards[0].rank === activeHand.cards[1].rank
    && state.balance >= activeHand.bet; // need balance for paid split; free split always ok
  const isSplitFree = canFreeSplit && isFreeEligibleSplit(activeHand!.cards[0].rank);
  const canDouble = activeHand && activeHand.cards.length === 2;
  const isDoubleFree = canDouble && isFreeEligibleDouble(activeHand!.cards);

  // Dealer total for display — visible cards only while hole card is hidden
  const holeHidden = ['dealing', 'insurance', 'player'].includes(state.phase);
  const visibleDealerCards = state.dealerCards.filter(c => !c.isHidden);
  const dealerVisibleTotal = visibleDealerCards.length > 0 ? getHandValue(visibleDealerCards).total : null;
  const dealerTotal = state.dealerCards.length > 0 && state.phase !== 'betting'
    ? getHandValue(state.dealerCards).total
    : null;
  const shownTotal = holeHidden ? dealerVisibleTotal : dealerTotal;

  const dealerPushed22 = dealerTotal === 22;

  return (
    <div className="w-full min-h-screen bg-[#072412] text-[#f7e8ba] font-sans sm:flex sm:flex-row relative">
      {showWin && <CoinShower />}

      {/* ── Game Board ── */}
      <div className="flex-1 flex flex-col items-center px-2 sm:px-4
                      pb-[215px] sm:pb-0 min-h-screen">

        {/* ── Header ── */}
        <div className="w-full shrink-0 flex justify-between items-center font-serif pt-2 pb-1 gap-2">
          <div className="text-lg sm:text-2xl font-bold tracking-widest text-amber-500 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] shrink-0">
            POT OF GOLD
          </div>
          <div className="flex items-center gap-2 sm:gap-6 min-w-0">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-emerald-500/80 text-[10px] tracking-widest uppercase font-bold">Session</span>
              <span className="text-amber-100/60 text-xs whitespace-nowrap">
                W: {state.stats.wins} &bull; L: {state.stats.losses} &bull; P: {state.stats.pushes} &bull; BJ: {state.stats.blackjacks}
                {state.stats.pogWins > 0 && <span className="text-yellow-400 ml-2">POG: {state.stats.pogWins}</span>}
              </span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-emerald-500/80 text-[10px] tracking-widest uppercase font-bold">Balance</span>
              <span className="text-xl sm:text-2xl font-bold text-yellow-400 drop-shadow-md">${state.balance.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* ── Dealer ── */}
        <div className="shrink-0 flex flex-col items-center mt-16 sm:mt-0 pt-1 sm:pt-2">
          <div className="flex items-center gap-2 mb-1">
            <div className="text-emerald-500/70 text-[10px] tracking-widest uppercase font-bold">Dealer</div>
            {shownTotal !== null && (
              <div className={`px-2 sm:px-3 py-0.5 rounded-full font-bold border text-xs sm:text-sm ${
                dealerPushed22 ? 'bg-yellow-900/60 text-yellow-400 border-yellow-800' :
                !holeHidden && dealerTotal! > 21 ? 'bg-red-900/50 text-red-400 border-red-900' :
                'bg-black/40 text-emerald-400 border-emerald-900/50'}`}>
                {dealerPushed22 ? 'PUSH 22'
                  : !holeHidden && dealerTotal! > 21 ? `BUST (${dealerTotal})`
                  : holeHidden ? `${shownTotal} + ?`
                  : dealerTotal}
              </div>
            )}
          </div>
          <div className="relative h-[80px] sm:h-[120px] flex justify-center overflow-visible">
            <AnimatePresence>
              {state.dealerCards.map((c, i) => <CardComponent key={c.id} card={c} index={i} />)}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Message + Token bar ── */}
        <div className="shrink-0 flex flex-col items-center gap-1 py-1 sm:my-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={state.message}
              initial={{ opacity: 0, y: 6, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6 }}
              className="text-base sm:text-xl font-serif text-amber-400 drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] text-center"
            >
              {state.message}
            </motion.div>
          </AnimatePresence>
          {(state.phase === 'player' || state.phase === 'resolved') && state.potOfGoldBet > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-yellow-500/70 uppercase tracking-widest font-bold hidden sm:inline">POG Tokens</span>
              <div className="flex gap-0.5 sm:gap-1">
                {Array.from({ length: 7 }, (_, i) => <Token key={i} lit={i < state.freeBetTokens} />)}
              </div>
              {state.freeBetTokens > 0 && (
                <span className="text-[10px] text-yellow-400 font-bold">{getPogPayout(state.freeBetTokens)}:1</span>
              )}
            </div>
          )}
          {state.phase === 'resolved' && state.pogPayout > 0 && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              className="px-3 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-yellow-400 font-bold text-xs sm:text-sm">
              POG WIN +${state.pogPayout - state.potOfGoldBet}
            </motion.div>
          )}
          {state.phase === 'resolved' && state.potOfGoldBet > 0 && state.pogPayout === 0 && (
            <div className="text-[10px] text-red-400/60 font-bold">POG lost -${state.potOfGoldBet}</div>
          )}
        </div>

        {/* ── Player Hands / Betting circles ── */}
        <div className="w-full flex items-center justify-center py-5 sm:py-6 flex-1">
          {state.phase === 'betting' ? (
            <div className="flex items-center justify-center gap-6 sm:gap-8">
              <div className="flex flex-col items-center gap-1">
                <div className="text-[10px] text-emerald-500/70 uppercase tracking-widest font-bold">Main Bet</div>
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-dashed border-emerald-500/30 flex items-center justify-center cursor-pointer hover:border-amber-400/50 transition-colors bg-emerald-950/30"
                  onClick={() => { sounds.chip(); dispatch({ type: 'CLEAR_BET' }); }}
                >
                  <div className="text-center">
                    <div className="text-lg sm:text-xl text-yellow-400 font-bold">${state.currentBet}</div>
                    {state.currentBet > 0 && <div className="text-[9px] text-emerald-500/50 uppercase">clear</div>}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="text-[10px] text-yellow-500/80 uppercase tracking-widest font-bold">★ Pot of Gold</div>
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-4 border-dashed border-yellow-600/40 flex items-center justify-center cursor-pointer hover:border-yellow-400/60 transition-colors bg-yellow-950/20"
                  onClick={() => { sounds.chip(); dispatch({ type: 'CLEAR_POG_BET' }); }}
                >
                  <div className="text-center">
                    <div className="text-lg sm:text-xl text-yellow-400 font-bold">${state.potOfGoldBet}</div>
                    {state.potOfGoldBet > 0 && <div className="text-[9px] text-yellow-600/60 uppercase">clear</div>}
                  </div>
                </div>
                <div className="text-[9px] text-yellow-600/50 text-center leading-tight">Pays on free bets · max $25</div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center gap-6 sm:gap-10">
              {state.playerHands.map((hand, i) => {
                const val = getHandValue(hand.cards);
                return (
                  <div key={hand.id}
                    className={`flex flex-col items-center transition-all duration-300 ${state.activeHandIndex === i ? 'opacity-100 sm:scale-105' : 'opacity-60 sm:scale-95'}`}
                  >
                    {/* Total + free badge above cards */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className={`px-2 sm:px-3 py-0.5 rounded-full font-bold border text-xs sm:text-sm ${
                        val.total > 21 ? 'text-red-500 border-red-900/50 bg-red-950/30' :
                        val.total === 21 ? 'text-yellow-300 border-yellow-700/50 bg-yellow-950/30' :
                        'text-amber-400 border-amber-900/50 bg-black/40'}`}>
                        {val.total > 21 ? 'BUST' : val.isSoft && val.total < 21 ? `Soft ${val.total}` : val.total}
                      </div>
                      {(hand.isFreeSplit || hand.isFreeDoubled) && (
                        <div className="px-1.5 py-0.5 rounded-full bg-yellow-500/20 border border-yellow-500/40 text-[9px] text-yellow-400 font-bold uppercase">
                          {hand.isFreeSplit && hand.isFreeDoubled ? 'Free ×2' : hand.isFreeSplit ? 'Free Split' : 'Free Dbl'}
                        </div>
                      )}
                    </div>
                    {/* Cards */}
                    <div className="relative h-[100px] sm:h-[150px] flex justify-center overflow-visible">
                      <AnimatePresence>
                        {hand.cards.map((c, j) => <CardComponent key={c.id} card={c} index={j} isPlayer />)}
                      </AnimatePresence>
                    </div>
                    {/* Bet + payout */}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-amber-400 font-bold text-xs sm:text-sm">${hand.bet}</span>
                      {hand.isResolved && (
                        <span className={`text-xs sm:text-sm font-black ${
                          hand.payout > hand.bet ? 'text-emerald-400' :
                          hand.payout === hand.bet ? 'text-gray-400' : 'text-red-500'}`}>
                          {hand.payout > hand.bet ? `+$${hand.payout - hand.bet}` :
                           hand.payout === hand.bet ? 'PUSH' : `-$${hand.bet}`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Round summary (resolved) shown in content area on mobile ── */}
        {state.phase === 'resolved' && (() => {
          const { lines, net } = buildExplanation(state);
          return (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md mx-auto bg-black/50 border border-emerald-800/40 rounded-2xl px-4 py-3 flex flex-col gap-1 shadow-xl mt-2 sm:hidden"
            >
              <div className="text-[10px] text-emerald-500/60 uppercase tracking-widest font-bold">Round Summary</div>
              {lines.map((l, i) => (
                <div key={i} className={`text-xs font-medium ${l.color}`}>{l.text}</div>
              ))}
              <div className={`mt-1 pt-1.5 border-t border-emerald-800/30 text-sm font-black ${net > 0 ? 'text-emerald-400' : net < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {net > 0 ? `+$${net} this round` : net < 0 ? `-$${Math.abs(net)} this round` : 'Break even'}
              </div>
            </motion.div>
          );
        })()}

        {/* ── Desktop controls (inline, desktop only) ── */}
        <div className="hidden sm:flex flex-col items-center gap-3 w-full max-w-3xl mt-2 mb-4">

          {state.phase === 'betting' && (
            <>
              <div className="text-[10px] text-emerald-500/50 uppercase tracking-widest">
                Click chip → add to bet · click circle → clear
              </div>
              <div className="flex items-center gap-2 bg-emerald-950/80 px-5 py-2 rounded-[3rem] border border-emerald-500/20 shadow-2xl backdrop-blur-md">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] text-emerald-500/60 uppercase tracking-widest">Main</span>
                  <div className="flex gap-2">
                    {[1, 5, 25, 100, 500].map(amt => (
                      <Chip key={amt} amount={amt} onClick={() => { sounds.chip(); dispatch({ type: 'PLACE_BET', amount: amt }); }} />
                    ))}
                  </div>
                </div>
                <div className="w-px h-12 bg-emerald-500/20 mx-1" />
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] text-yellow-500/70 uppercase tracking-widest">★ POG (max $25)</span>
                  <div className="flex gap-2">
                    {[1, 5, 25].map(amt => (
                      <Chip key={amt} amount={amt} small onClick={() => { sounds.chip(); dispatch({ type: 'PLACE_POG_BET', amount: amt }); }} />
                    ))}
                  </div>
                </div>
                <div className="w-px h-12 bg-emerald-500/20 mx-1" />
                <ActionBtn disabled={state.currentBet === 0} onClick={() => { sounds.card(); dispatch({ type: 'DEAL' }); }}
                  className="bg-gradient-to-b from-amber-400 to-amber-600 text-amber-950 hover:from-amber-300 hover:to-amber-500 border-2 border-amber-300/50 px-8">
                  DEAL
                </ActionBtn>
              </div>
              {state.potOfGoldBet > 0 && (
                <div className="bg-yellow-950/40 border border-yellow-700/30 rounded-xl px-4 py-2 text-xs max-w-xs w-full">
                  <div className="text-yellow-400 font-bold text-center mb-1 text-[11px] uppercase tracking-widest">Pot of Gold Payouts</div>
                  <PogPayTable tokens={0} bet={state.potOfGoldBet} />
                  <div className="text-[9px] text-yellow-700/60 text-center mt-2">Earn tokens with Free Splits & Free Doubles</div>
                </div>
              )}
            </>
          )}

          {state.phase === 'insurance' && (
            <div className="flex flex-col items-center gap-2">
              <div className="text-xs text-emerald-400/70 font-bold uppercase tracking-widest">Insurance pays 2:1 · costs ${Math.floor(state.currentBet / 2)}</div>
              <div className="flex gap-4">
                <ActionBtn onClick={() => dispatch({ type: 'INSURANCE', accept: true })} className="bg-emerald-600 hover:bg-emerald-500 text-white w-40">YES — INSURE</ActionBtn>
                <ActionBtn onClick={() => dispatch({ type: 'INSURANCE', accept: false })} className="bg-red-800 hover:bg-red-700 text-white w-40">NO THANKS</ActionBtn>
              </div>
            </div>
          )}

          {state.phase === 'player' && activeHand && (
            <div className="flex flex-col items-center gap-2">
              {(isDoubleFree || isSplitFree) && (
                <div className="text-[10px] text-yellow-400/80 font-bold uppercase tracking-widest animate-pulse">★ Free bet available — earns a POG token!</div>
              )}
              <div className="flex justify-center gap-2 flex-wrap">
                <ActionBtn onClick={() => { sounds.card(); dispatch({ type: 'HIT' }); }} className="bg-red-600 hover:bg-red-500 text-white border border-red-400/50 w-28">HIT</ActionBtn>
                <ActionBtn onClick={() => dispatch({ type: 'STAND' })} className="bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/50 w-28">STAND</ActionBtn>
                <ActionBtn disabled={!canDouble && activeHand.cards.length > 2} onClick={() => { sounds.card(); dispatch({ type: 'DOUBLE' }); }}
                  className={`border w-32 ${isDoubleFree ? 'bg-yellow-700/80 hover:bg-yellow-600 text-yellow-100 border-yellow-500/50' : 'bg-blue-900/80 hover:bg-blue-800 text-blue-100 border-blue-500/30'}`}>
                  {isDoubleFree ? '★ FREE DBL' : 'DOUBLE'}
                </ActionBtn>
                {canFreeSplit && (
                  <ActionBtn onClick={() => { sounds.card(); dispatch({ type: 'SPLIT' }); }}
                    className={`border w-32 ${isSplitFree ? 'bg-yellow-700/80 hover:bg-yellow-600 text-yellow-100 border-yellow-500/50' : 'bg-purple-900/80 hover:bg-purple-800 text-purple-100 border-purple-500/30'}`}>
                    {isSplitFree ? '★ FREE SPLIT' : 'SPLIT'}
                  </ActionBtn>
                )}
              </div>
            </div>
          )}

          {state.phase === 'resolved' && (() => {
            const { lines, net } = buildExplanation(state);
            return (
              <div className="flex flex-col items-center gap-3 w-full max-w-md">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="w-full bg-black/50 border border-emerald-800/40 rounded-2xl px-5 py-4 flex flex-col gap-1.5 shadow-xl">
                  <div className="text-[10px] text-emerald-500/60 uppercase tracking-widest font-bold mb-1">Round Summary</div>
                  {lines.map((l, i) => <div key={i} className={`text-sm font-medium ${l.color}`}>{l.text}</div>)}
                  <div className={`mt-2 pt-2 border-t border-emerald-800/30 text-base font-black ${net > 0 ? 'text-emerald-400' : net < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                    {net > 0 ? `+$${net} this round` : net < 0 ? `-$${Math.abs(net)} this round` : 'Break even'}
                  </div>
                </motion.div>
                <ActionBtn onClick={() => dispatch({ type: 'NEW_ROUND' })}
                  className="px-10 bg-gradient-to-b from-amber-400 to-amber-600 text-amber-950 hover:from-amber-300 hover:to-amber-500 border-2 border-amber-300/50 shadow-[0_0_15px_rgba(251,191,36,0.5)]">
                  NEW ROUND
                </ActionBtn>
              </div>
            );
          })()}
        </div>
      </div>

      {/* ── Strategy panel: in page flow below game on mobile, right column on desktop ── */}
      <div className="sm:hidden w-full px-2 pb-8">
        <StrategyPanel state={state} />
      </div>
      <div className="hidden sm:block">
        <StrategyPanel state={state} />
      </div>

      {/* ── Mobile controls: fixed to bottom of viewport, never overlaps cards ── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#072412] border-t border-emerald-900/50 px-3 pt-2 pb-5">

        {state.phase === 'betting' && (
          <div className="flex flex-col gap-1.5">
            <div className="text-[9px] text-emerald-500/40 uppercase tracking-widest text-center">
              Tap chip → add to bet · tap circle → clear
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-[9px] text-emerald-500/60 font-bold uppercase w-8 shrink-0 text-right">Main</span>
              <div className="flex gap-1.5">
                {[1, 5, 25, 100, 500].map(amt => (
                  <Chip key={amt} amount={amt} small onClick={() => { sounds.chip(); dispatch({ type: 'PLACE_BET', amount: amt }); }} />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="text-[9px] text-yellow-500/60 font-bold uppercase w-8 shrink-0 text-right">★</span>
              <div className="flex gap-1.5">
                {[1, 5, 25].map(amt => (
                  <Chip key={amt} amount={amt} small onClick={() => { sounds.chip(); dispatch({ type: 'PLACE_POG_BET', amount: amt }); }} />
                ))}
              </div>
            </div>
            <button disabled={state.currentBet === 0} onClick={() => { sounds.card(); dispatch({ type: 'DEAL' }); }}
              className="w-full py-3 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 text-amber-950 font-bold text-base border-2 border-amber-300/50 shadow-lg disabled:opacity-40 active:scale-95 transition-transform mt-0.5">
              DEAL
            </button>
          </div>
        )}

        {state.phase === 'insurance' && (
          <div className="flex flex-col gap-2">
            <div className="text-[10px] text-emerald-400/70 font-bold uppercase tracking-widest text-center">
              Insurance pays 2:1 · costs ${Math.floor(state.currentBet / 2)}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => dispatch({ type: 'INSURANCE', accept: true })}
                className="py-3.5 rounded-full bg-emerald-600 text-white font-bold text-sm active:scale-95 transition-transform">YES — INSURE</button>
              <button onClick={() => dispatch({ type: 'INSURANCE', accept: false })}
                className="py-3.5 rounded-full bg-red-800 text-white font-bold text-sm active:scale-95 transition-transform">NO THANKS</button>
            </div>
          </div>
        )}

        {state.phase === 'player' && activeHand && (
          <div className="flex flex-col gap-1.5">
            {(isDoubleFree || isSplitFree) && (
              <div className="text-[10px] text-yellow-400/80 font-bold uppercase tracking-widest animate-pulse text-center">
                ★ Free bet available — earns a POG token!
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => { sounds.card(); dispatch({ type: 'HIT' }); }}
                className="py-3.5 rounded-full bg-red-600 text-white font-bold text-sm active:scale-95 transition-transform border border-red-400/50">HIT</button>
              <button onClick={() => dispatch({ type: 'STAND' })}
                className="py-3.5 rounded-full bg-emerald-600 text-white font-bold text-sm active:scale-95 transition-transform border border-emerald-400/50">STAND</button>
              <button disabled={!canDouble} onClick={() => { sounds.card(); dispatch({ type: 'DOUBLE' }); }}
                className={`py-3.5 rounded-full font-bold text-sm active:scale-95 transition-transform border disabled:opacity-40 ${isDoubleFree ? 'bg-yellow-600 text-yellow-950 border-yellow-400/50' : 'bg-blue-800 text-blue-100 border-blue-500/30'}`}>
                {isDoubleFree ? '★ FREE DBL' : 'DOUBLE'}
              </button>
              {canFreeSplit ? (
                <button onClick={() => { sounds.card(); dispatch({ type: 'SPLIT' }); }}
                  className={`py-3.5 rounded-full font-bold text-sm active:scale-95 transition-transform border ${isSplitFree ? 'bg-yellow-600 text-yellow-950 border-yellow-400/50' : 'bg-purple-800 text-purple-100 border-purple-500/30'}`}>
                  {isSplitFree ? '★ FREE SPLIT' : 'SPLIT'}
                </button>
              ) : <div />}
            </div>
          </div>
        )}

        {(state.phase === 'resolved' || state.phase === 'dealer_reveal' || state.phase === 'dealer_play') && (
          <button onClick={() => state.phase === 'resolved' && dispatch({ type: 'NEW_ROUND' })}
            disabled={state.phase !== 'resolved'}
            className="w-full py-3 rounded-full bg-gradient-to-b from-amber-400 to-amber-600 text-amber-950 font-bold text-base border-2 border-amber-300/50 shadow-[0_0_15px_rgba(251,191,36,0.5)] disabled:opacity-50 active:scale-95 transition-transform">
            {state.phase === 'resolved' ? 'NEW ROUND' : '...'}
          </button>
        )}
      </div>
    </div>
  );
}
