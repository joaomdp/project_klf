
import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { UserTeam, Player } from '../types';
import aisolutIcon from '../assets/images/icons/aisolut.png';

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
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const playersList = Object.values(userTeam.players) as (Player | undefined)[];
      const hiredPlayers = playersList.filter((p): p is Player => !!p);
      
      const currentTeamInfo = hiredPlayers.length > 0
        ? hiredPlayers.map(p => `${p.name} (${p.role}) - C$${p.price} - ${p.points}pts - Média: ${p.avgPoints.toFixed(1)}`).join('\n  ')
        : 'Ainda não escalou jogadores';

      // Calcula valor total do time
      const teamValue = hiredPlayers.reduce((sum, p) => sum + p.price, 0);
      const slotsVazios = 5 - hiredPlayers.length;
      
      // Top 10 jogadores por custo-benefício (pontos por crédito)
      const topValuePlayers = availablePlayers
        .map(p => ({
          ...p,
          valueRatio: p.avgPoints / p.price // Pontos por crédito gasto
        }))
        .sort((a, b) => b.valueRatio - a.valueRatio)
        .slice(0, 10);

      // Jogadores disponíveis com o orçamento atual
      const affordablePlayers = availablePlayers
        .filter(p => p.price <= userTeam.budget)
        .sort((a, b) => b.avgPoints - a.avgPoints)
        .slice(0, 15);

      const marketContext = availablePlayers.length > 0 ? `

📊 DADOS DO MERCADO (${availablePlayers.length} jogadores disponíveis):

🏆 TOP 10 CUSTO-BENEFÍCIO (Média de pontos ÷ Preço):
${topValuePlayers.map((p, i) => 
  `${i + 1}. ${p.name} (${p.role}) - C$${p.price} - Média: ${p.avgPoints.toFixed(1)} - Ratio: ${p.valueRatio.toFixed(2)}`
).join('\n')}

💰 TOP 15 ACESSÍVEIS COM SEU ORÇAMENTO (C$${userTeam.budget.toFixed(1)}):
${affordablePlayers.slice(0, 15).map((p, i) => 
  `${i + 1}. ${p.name} (${p.role}) - C$${p.price} - Média: ${p.avgPoints.toFixed(1)}`
).join('\n')}` : '';

      const prompt = `Você é o AI-SOLUT, assistente de fantasy especializado em League of Legends da "Kings Lendas". 

📋 TIME ATUAL DO USUÁRIO:
  ${currentTeamInfo}

💼 SITUAÇÃO FINANCEIRA:
  - Orçamento disponível: C$${userTeam.budget.toFixed(1)}
  - Valor investido no time: C$${teamValue.toFixed(1)}
  - Vagas vazias: ${slotsVazios}
  - Total de pontos: ${userTeam.totalPoints}

${marketContext}

❓ PERGUNTA DO USUÁRIO: "${query}"

📝 INSTRUÇÕES PARA RESPOSTA:
1. Se perguntarem sobre recomendações, use os dados do mercado acima
2. Priorize jogadores com melhor custo-benefício (ratio pontos/preço)
3. Considere o orçamento disponível do usuário
4. Sugira trocas se puder melhorar o time sem estourar o orçamento
5. Se o time está incompleto, sugira jogadores acessíveis para preencher
6. Seja direto e objetivo, mas entusiasta como um coach de esports
7. Use emojis para deixar a resposta mais visual
8. Ao sugerir jogadores, sempre mencione: nome, posição, preço e média de pontos

Responda em português de forma clara e estratégica.`;

      const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setResponse(result.text || 'O Coach está pensando em outra coisa agora...');
    } catch (error) {
      console.error('AI Error:', error);
      setResponse('Ops, a conexão com o servidor caiu. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col min-h-[calc(100dvh-200px)] sm:h-[calc(100vh-250px)]">
      <div className="flex-1 overflow-y-auto mb-6 space-y-4 pr-2 custom-scrollbar">
        <div className="flex gap-4">
          <div className="w-16 h-16 flex items-center justify-center shrink-0">
            <img src={aisolutIcon} alt="AI-SOLUT" className="w-full h-full object-contain" />
          </div>
          <div className="glass-card p-6 rounded-2xl rounded-tl-none border-l-4 border-[#6366F1]">
            <p className="text-white text-sm leading-relaxed mb-4">
              Bora montar um time com chat? O que poderia dar errado!? 🤖
            </p>
            <p className="text-white text-sm leading-relaxed mb-4">
              Tenho acesso a todos os <strong>{availablePlayers.length} jogadores do mercado</strong> e posso te ajudar com:
            </p>
            <ul className="text-white text-sm space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-[#6366F1]">💰</span>
                <span>Sugestões de jogadores com <strong>melhor custo-benefício</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#6366F1]">🎯</span>
                <span>Montar um time competitivo com seu <strong>orçamento atual</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#6366F1]">🔄</span>
                <span>Analisar possíveis <strong>trocas para melhorar seu time</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-[#6366F1]">📊</span>
                <span>Avaliar sua <strong>escalação atual</strong></span>
              </li>
            </ul>
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-gray-400 text-xs mb-2">Experimente perguntar:</p>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => setQuery("Monte o melhor time possível com meu orçamento")}
                  className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#6366F1]/30 px-3 py-1.5 rounded-full transition-all"
                >
                  "Monte o melhor time com meu orçamento"
                </button>
                <button 
                  onClick={() => setQuery("Qual o melhor custo-benefício por posição?")}
                  className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#6366F1]/30 px-3 py-1.5 rounded-full transition-all"
                >
                  "Melhor custo-benefício por lane"
                </button>
                <button 
                  onClick={() => setQuery("Analise meu time atual")}
                  className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#6366F1]/30 px-3 py-1.5 rounded-full transition-all"
                >
                  "Analise meu time"
                </button>
              </div>
            </div>
          </div>
        </div>

        {response && (
          <div className="flex gap-4">
            <div className="w-16 h-16 flex items-center justify-center shrink-0">
              <img src={aisolutIcon} alt="AI-SOLUT" className="w-full h-full object-contain" />
            </div>
            <div className="glass-card p-6 rounded-2xl rounded-tl-none border-l-4 border-[#6366F1]">
              <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                {response}
              </p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex gap-4 animate-pulse">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center border border-white/10 shrink-0"></div>
            <div className="bg-white/5 p-4 rounded-2xl w-2/3 h-12"></div>
          </div>
        )}
      </div>

      <div className="relative">
        <input 
          type="text"
          className="w-full bg-black/40 border-2 border-white/5 rounded-2xl py-5 pl-8 pr-20 focus:outline-none focus:border-[#6366F1]/60 transition-all text-white placeholder-gray-600 shadow-2xl backdrop-blur-xl"
          placeholder="Pergunte ao coach (ex: 'Quem é o melhor mid custo-benefício?')..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && askCoach()}
        />
        <button 
          onClick={askCoach}
          disabled={loading}
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#6366F1] text-black p-3.5 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(94,108,255,0.4)] disabled:opacity-50"
        >
          <i className="fa-solid fa-paper-plane"></i>
        </button>
      </div>
    </div>
  );
};

export default AICoach;
