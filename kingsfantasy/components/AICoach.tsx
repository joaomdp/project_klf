
import React, { useState } from 'react';
import { UserTeam, Player } from '../types';
import aisolutIcon from '../assets/images/icons/aisolut.png';
import { DataService } from '../services/api';

interface AICoachProps {
  userTeam: UserTeam;
  availablePlayers?: Player[];
}

const AICoach: React.FC<AICoachProps> = ({ userTeam, availablePlayers = [] }) => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const askCoach = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setResponse(null);

    try {
      const result = await DataService.askAICoach({
        query,
        userTeam,
        availablePlayers
      });

      if (!result.ok) {
        setResponse(result.error || 'Ops, a conexão com o servidor caiu. Tente novamente mais tarde.');
        return;
      }

      setResponse(result.response || 'O Coach está pensando em outra coisa agora...');
    } catch (error) {
      console.error('AI Error:', error);
      setResponse('Ops, a conexão com o servidor caiu. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col px-3 xs:px-4 sm:px-0" style={{ minHeight: 'calc(100dvh - 180px)' }}>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto mb-4 sm:mb-6 space-y-4 custom-scrollbar">

        {/* Mensagem inicial do coach */}
        <div className="flex gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-11 sm:h-11 flex items-center justify-center shrink-0 mt-1">
            <img src={aisolutIcon} alt="AI-SOLUT" className="w-full h-full object-contain" />
          </div>
          <div className="glass-card flex-1 min-w-0 p-4 sm:p-5 rounded-xl sm:rounded-2xl rounded-tl-none border-l-[3px] border-[#3b82f6]">
            <p className="text-white text-xs sm:text-sm leading-relaxed mb-3">
              Bora montar um time com chat? O que poderia dar errado!? 🤖
            </p>
            <p className="text-white text-xs sm:text-sm leading-relaxed mb-3">
              Tenho acesso a todos os <strong>{availablePlayers.length} jogadores do mercado</strong> e posso te ajudar com:
            </p>
            <ul className="text-white text-xs sm:text-sm space-y-1.5 sm:space-y-2 ml-3 sm:ml-4 mb-4">
              <li className="flex items-start gap-2">
                <span>💰</span>
                <span>Sugestões com <strong>melhor custo-benefício</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span>🎯</span>
                <span>Time competitivo com seu <strong>orçamento atual</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span>🔄</span>
                <span><strong>Trocas</strong> para melhorar seu time</span>
              </li>
              <li className="flex items-start gap-2">
                <span>📊</span>
                <span>Avaliar sua <strong>escalação atual</strong></span>
              </li>
            </ul>

            <div className="pt-3 border-t border-white/10">
              <p className="text-gray-500 text-[10px] sm:text-xs mb-2 uppercase tracking-wider font-black">Experimente:</p>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {[
                  { label: 'Melhor time com meu orçamento', query: 'Monte o melhor time possível com meu orçamento' },
                  { label: 'Custo-benefício por lane', query: 'Qual o melhor custo-benefício por posição?' },
                  { label: 'Analise meu time', query: 'Analise meu time atual' },
                ].map((chip) => (
                  <button
                    key={chip.label}
                    onClick={() => setQuery(chip.query)}
                    className="text-[10px] sm:text-[11px] bg-white/5 hover:bg-[#3b82f6]/10 border border-white/10 hover:border-[#3b82f6]/40 px-3 py-1.5 rounded-full transition-all whitespace-nowrap touch-manipulation shrink-0 text-gray-300 hover:text-white"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Resposta do coach */}
        {response && (
          <div className="flex gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-11 sm:h-11 flex items-center justify-center shrink-0 mt-1">
              <img src={aisolutIcon} alt="AI-SOLUT" className="w-full h-full object-contain" />
            </div>
            <div className="glass-card flex-1 min-w-0 p-4 sm:p-5 rounded-xl sm:rounded-2xl rounded-tl-none border-l-[3px] border-[#3b82f6]">
              <p className="text-white text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                {response}
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex gap-2 sm:gap-3 animate-pulse">
            <div className="w-8 h-8 sm:w-11 sm:h-11 bg-white/5 rounded-full shrink-0"></div>
            <div className="bg-white/5 rounded-xl flex-1 h-12 sm:h-14"></div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="relative">
        <input
          type="text"
          className="w-full bg-black/40 border-2 border-white/5 rounded-xl sm:rounded-2xl py-3.5 sm:py-5 pl-4 sm:pl-8 pr-14 sm:pr-20 focus:outline-none focus:border-[#3b82f6]/60 transition-all text-white text-sm placeholder-gray-600 shadow-2xl backdrop-blur-xl"
          placeholder="Pergunte ao coach..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && askCoach()}
        />
        <button
          onClick={askCoach}
          disabled={loading}
          className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 bg-[#3b82f6] text-black p-2.5 sm:p-3.5 rounded-lg sm:rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(59,130,246,0.4)] disabled:opacity-50 touch-manipulation"
        >
          <i className="fa-solid fa-paper-plane text-sm sm:text-base"></i>
        </button>
      </div>
    </div>
  );
};

export default AICoach;
