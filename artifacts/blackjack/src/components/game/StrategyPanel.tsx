import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GameState, getStrategyRecommendation, getHandValue, hardStrategyDisplay, softStrategyDisplay, pairStrategyDisplay } from "../../lib/gameLogic";

const MatrixGrid = ({ type, state }: { type: 'hard' | 'soft' | 'pair', state: GameState }) => {
  const cols = ['2','3','4','5','6','7','8','9','10','A'];
  
  let rows: string[];
  let strategyMap: Record<string, string[]>;
  
  if (type === 'hard') {
    rows = ['17+','16','15','14','13','12','11','10','9','8-'];
    strategyMap = hardStrategyDisplay;
  } else if (type === 'soft') {
    rows = ['20','19','18','17','16','15','14','13'];
    strategyMap = softStrategyDisplay;
  } else {
    rows = ['A','10','9','8','7','6','5','4','3','2'];
    strategyMap = pairStrategyDisplay;
  }

  let activeRow: number | null = null;
  let activeCol: number | null = null;
  
  if (state.phase === 'player' && state.dealerCards[0] && state.playerHands[state.activeHandIndex]) {
     const upcard = state.dealerCards[0];
     activeCol = upcard.rank === 'A' ? 9 : (['10','J','Q','K'].includes(upcard.rank) ? 8 : parseInt(upcard.rank) - 2);
     
     const hand = state.playerHands[state.activeHandIndex];
     const val = getHandValue(hand.cards);
     
     if (type === 'pair' && hand.cards.length === 2 && hand.cards[0].rank === hand.cards[1].rank) {
       const r = hand.cards[0].rank;
       const normalized = r === 'A' ? 'A' : (['10','J','Q','K'].includes(r) ? '10' : r);
       activeRow = rows.indexOf(normalized);
     } else if (type === 'soft' && val.isSoft) {
       if (val.total >= 20) activeRow = rows.indexOf('20');
       else activeRow = rows.indexOf(val.total.toString());
     } else if (type === 'hard' && !val.isSoft) {
       if (val.total >= 17) activeRow = rows.indexOf('17+');
       else if (val.total <= 8) activeRow = rows.indexOf('8-');
       else activeRow = rows.indexOf(val.total.toString());
     }
  }

  const bgColors: Record<string, string> = {
    H: 'bg-red-500/80 text-white',
    S: 'bg-emerald-500/80 text-white',
    D: 'bg-blue-500/80 text-white',
    P: 'bg-purple-500/80 text-white',
  };

  return (
    <table className="w-full text-xs font-sans text-center border-collapse">
      <thead>
        <tr>
          <th className="p-1 border border-emerald-900/50 bg-black/20 text-emerald-500"></th>
          {cols.map((c, i) => (
             <th key={c} className={`p-1 border border-emerald-900/50 bg-black/20 text-amber-500 ${activeCol === i ? 'bg-amber-900/60 text-amber-300' : ''}`}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r}>
            <th className={`p-1 border border-emerald-900/50 bg-black/20 text-emerald-500 font-bold ${activeRow === i ? 'bg-amber-900/60 text-amber-300' : ''}`}>{r}</th>
            {strategyMap[r].map((action, j) => {
              const isActive = activeRow === i && activeCol === j;
              return (
                <td key={j} className={`p-1 border border-emerald-900/50 ${bgColors[action]} ${isActive ? 'ring-2 ring-white ring-inset shadow-[0_0_10px_rgba(255,255,255,0.8)] z-10 relative font-bold text-sm scale-110' : 'opacity-80'}`}>
                  {action}
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const StrategyPanel = ({ state }: { state: GameState }) => {
  const dealerUpcard = state.dealerCards[0];
  const activeHand = state.playerHands[state.activeHandIndex];
  
  let rec: string | null = null;
  if (state.phase === 'player' && dealerUpcard && activeHand) {
    rec = getStrategyRecommendation(activeHand.cards, dealerUpcard);
  }
  
  const recColors: Record<string, string> = {
    H: 'text-red-500', S: 'text-emerald-500', D: 'text-blue-500', P: 'text-purple-500',
  };
  const recLabels: Record<string, string> = {
    H: 'HIT', S: 'STAND', D: 'DOUBLE DOWN', P: 'SPLIT',
  };
  
  let activeTab = 'hard';
  if (activeHand && activeHand.cards.length === 2) {
    if (activeHand.cards[0].rank === activeHand.cards[1].rank) activeTab = 'pair';
    else if (getHandValue(activeHand.cards).isSoft) activeTab = 'soft';
  }

  return (
    <div className="w-[420px] bg-emerald-950/90 border-l border-emerald-800/50 backdrop-blur-md p-6 flex flex-col sticky top-0 h-screen shadow-2xl relative z-10 overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <span className="text-3xl filter drop-shadow-md">☘️</span>
        <h2 className="text-xl font-serif text-amber-400 font-bold tracking-widest drop-shadow-md">STRATEGY GUIDE</h2>
      </div>
      
      {state.phase === 'player' && rec && (
        <div className="bg-black/40 rounded-xl p-4 mb-6 border border-emerald-500/20 text-center shadow-inner">
           <div className="text-emerald-500/70 text-xs font-bold uppercase tracking-widest mb-1">Recommended Action</div>
           <div className={`text-3xl font-black ${recColors[rec]} drop-shadow-md`}>
             {recLabels[rec]}
           </div>
        </div>
      )}
      
      <Tabs defaultValue="hard" value={activeTab} className="flex-1 flex flex-col">
         <TabsList className="grid grid-cols-3 bg-black/40 border border-emerald-800/50 mb-4 p-1 rounded-lg">
           <TabsTrigger value="hard" className="data-[state=active]:bg-emerald-800 data-[state=active]:text-amber-300 text-emerald-400 font-bold">Hard</TabsTrigger>
           <TabsTrigger value="soft" className="data-[state=active]:bg-emerald-800 data-[state=active]:text-amber-300 text-emerald-400 font-bold">Soft</TabsTrigger>
           <TabsTrigger value="pair" className="data-[state=active]:bg-emerald-800 data-[state=active]:text-amber-300 text-emerald-400 font-bold">Pairs</TabsTrigger>
         </TabsList>
         
         <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
           <TabsContent value="hard" className="m-0"><MatrixGrid type="hard" state={state} /></TabsContent>
           <TabsContent value="soft" className="m-0"><MatrixGrid type="soft" state={state} /></TabsContent>
           <TabsContent value="pair" className="m-0"><MatrixGrid type="pair" state={state} /></TabsContent>
         </div>
      </Tabs>
      
      <div className="mt-6 grid grid-cols-2 gap-3 text-xs font-bold text-emerald-100/80">
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-red-500/80 rounded shadow-sm" /> HIT (H)</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500/80 rounded shadow-sm" /> STAND (S)</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-blue-500/80 rounded shadow-sm" /> DOUBLE (D)</div>
        <div className="flex items-center gap-2"><div className="w-3 h-3 bg-purple-500/80 rounded shadow-sm" /> SPLIT (P)</div>
      </div>
    </div>
  );
};
