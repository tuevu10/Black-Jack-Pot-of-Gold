import { motion } from 'framer-motion';
import { Card as CardType } from '../../lib/gameLogic';

interface CardProps {
  card: CardType;
  index: number;
  isPlayer?: boolean;
}

export const CardComponent = ({ card, index, isPlayer = false }: CardProps) => {
  const { isHidden, rank, suit } = card;
  const isRed = suit === 'hearts' || suit === 'diamonds';
  const symbols = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };

  return (
    <motion.div
      initial={{ x: isPlayer ? 80 : 0, y: -160, opacity: 0, scale: 0.8 }}
      animate={{ x: index * 16, y: index * -2, opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, type: 'spring', damping: 15 }}
      style={{ zIndex: index }}
      className={`relative w-[72px] h-[100px] sm:w-[100px] sm:h-[140px] ${index > 0 ? 'ml-[-50px] sm:ml-[-70px]' : ''}`}
    >
      <motion.div
        animate={{ rotateY: isHidden ? 180 : 0 }}
        transition={{ duration: 0.6, type: 'spring' }}
        style={{ transformStyle: 'preserve-3d' }}
        className="w-full h-full relative"
      >
        {/* Face */}
        <div
          className="w-full h-full absolute top-0 left-0 rounded-lg sm:rounded-xl bg-white shadow-lg sm:shadow-xl border border-gray-300 p-1.5 sm:p-2 flex flex-col justify-between"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <div className={`text-sm sm:text-xl font-bold leading-none ${isRed ? 'text-red-600' : 'text-gray-900'}`}>{rank}</div>
          <div className={`text-2xl sm:text-5xl absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${isRed ? 'text-red-600' : 'text-gray-900'}`}>
            {symbols[suit]}
          </div>
          <div className={`text-sm sm:text-xl font-bold leading-none rotate-180 ${isRed ? 'text-red-600' : 'text-gray-900'}`}>{rank}</div>
        </div>

        {/* Back */}
        <div
          className="w-full h-full absolute top-0 left-0 rounded-lg sm:rounded-xl border-2 border-amber-600 shadow-xl overflow-hidden"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)',
          }}
        >
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at center, #fbbf24 2px, transparent 2px)', backgroundSize: '14px 14px' }} />
          <div className="absolute inset-1.5 sm:inset-2 border-2 border-amber-500/50 rounded-md sm:rounded-lg flex items-center justify-center bg-black/20">
            <span className="text-2xl sm:text-4xl opacity-80 filter drop-shadow-md">☘️</span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
