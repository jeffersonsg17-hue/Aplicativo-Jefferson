import React from 'react';
import { Copy, Feather, Check } from 'lucide-react';
import { Variation } from '../types';

interface VariationCardProps {
  variation: Variation;
  index: number;
}

const VariationCard: React.FC<VariationCardProps> = ({ variation, index }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(variation.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Visual styles getting progressively "older"
  const getCardStyle = (level: number) => {
    switch (level) {
      case 1: return "border-slate-600 bg-slate-800/40 text-slate-200 font-sans";
      case 2: return "border-slate-500 bg-slate-800/60 text-indigo-100 font-serif";
      case 3: return "border-antique-400/30 bg-[#2a2420] text-antique-100 font-serif italic";
      case 4: return "border-antique-500/50 bg-[#2f221a] text-antique-200 font-display";
      case 5: return "border-antique-600/70 bg-[#271c16] text-antique-400 font-display tracking-wide";
      default: return "border-slate-700 bg-slate-800";
    }
  };

  const getLabelColor = (level: number) => {
      if (level >= 4) return "text-antique-500 border-antique-500/30 bg-antique-900/20";
      if (level === 3) return "text-indigo-200 border-indigo-200/30 bg-indigo-900/20";
      return "text-slate-400 border-slate-500/30 bg-slate-900/20";
  }

  return (
    <div 
      className={`relative group rounded-xl border p-6 mb-6 transition-all duration-500 hover:shadow-xl w-full
        ${getCardStyle(variation.level)}
        transform hover:-translate-y-1 animate-fadeIn opacity-0
      `}
      style={{ animationDelay: `${index * 150}ms`, animationFillMode: 'forwards' }}
    >
      <div className="flex justify-between items-start mb-3">
        <span className={`text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border ${getLabelColor(variation.level)}`}>
          Nível {variation.level} • {variation.era}
        </span>
        <button 
          onClick={handleCopy}
          className="p-2 rounded-full hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
          title="Copiar texto"
        >
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>

      <div className="relative mb-4">
         {variation.level >= 4 && (
            <Feather className="absolute -left-10 -top-2 w-8 h-8 text-antique-700/20 rotate-45 hidden md:block" />
         )}
        <p className={`text-xl md:text-2xl leading-relaxed ${variation.level === 5 ? 'drop-shadow-sm' : ''}`}>
          "{variation.text}"
        </p>
      </div>

      <div className="border-t border-white/5 pt-3 mt-2">
        <p className="text-sm opacity-60 flex items-center gap-2">
           <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50"></span>
           {variation.explanation}
        </p>
      </div>
    </div>
  );
};

export default VariationCard;