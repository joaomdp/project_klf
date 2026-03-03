import React, { useState, useRef, useMemo, useEffect } from 'react';
import { CHAMPIONS_LIST } from '../constants';
import { DataService } from '../services/api';
import { AuthService } from '../services/auth';

interface OnboardingFlowProps {
  onComplete: (data: { userName: string; teamName: string; avatar: string; favoriteTeam: string; shield: any }) => void;
}

const SHIELD_SHAPES = ['fa-shield', 'fa-shield-halved', 'fa-shield-heart', 'fa-certificate', 'fa-clapperboard'];
const SHIELD_SYMBOLS = ['fa-bolt', 'fa-fire', 'fa-crown', 'fa-skull', 'fa-dragon', 'fa-ghost', 'fa-hand-fist'];
const COLORS = ['#FFFFFF', '#6366F1', '#FFB800', '#00FF94', '#00E0FF', '#FF4655', '#B05EFF', '#FF5EB0'];

// Lista de nomes reservados (Times oficiais)
const RESERVED_NAMES = ["T1", "LOUD", "PAIN", "FURIA", "FLUXO", "RED CANIDS", "KABUM", "INTZ", "LOS GRANDES", "ITAFANTASY", "LIBERTY", "VIVO KEYD", "KEYD"];

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  // Get user email from session
  const session = AuthService.getSession();
  const userEmail = session?.user?.email || '';
  
  // Sempre pula a etapa de verificação, pois:
  // 1. Login social já está autenticado
  // 2. Login email/senha já passou pela autenticação no Login.tsx
  // Se chegou aqui, o usuário já está autenticado
  const [step, setStep] = useState<'verify' | 'username' | 'fav-team' | 'team-name' | 'avatar'>('username');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [userName, setUserName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [dbTeams, setDbTeams] = useState<{id: string, name: string, logo: string}[]>([]);
  const [selectedFavTeam, setSelectedFavTeam] = useState<any>(null);
  const [selectedAvatar, setSelectedAvatar] = useState('');
  
  // Validation States
  const [userNameError, setUserNameError] = useState('');
  const [isCheckingUserName, setIsCheckingUserName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [isCheckingName, setIsCheckingName] = useState(false);

  // Search States
  const [champSearch, setChampSearch] = useState('');

  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  
  const [shieldShape, setShieldShape] = useState(SHIELD_SHAPES[0]);
  const [shieldColor, setShieldColor] = useState('#6366F1');
  const [shieldSymbol, setShieldSymbol] = useState(SHIELD_SYMBOLS[2]);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const teamButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const fetchTeams = async () => {
      setIsLoadingTeams(true);
      const teams = await DataService.getTeams();
      setDbTeams(teams);
      setIsLoadingTeams(false);

      // Preload images immediately
      teams.forEach(team => {
        const img = new Image();
        img.src = team.logo;
      });
    };
    fetchTeams();
  }, []);

  useEffect(() => {
    if (selectedFavTeam?.id && teamButtonRefs.current[selectedFavTeam.id]) {
      const buttonElement = teamButtonRefs.current[selectedFavTeam.id];
      setTimeout(() => {
        buttonElement?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }, 150);
    }
  }, [selectedFavTeam]);

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.substring(value.length - 1);
    setCode(newCode);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleUserNameSubmit = async () => {
    const normalizedUserName = userName.toUpperCase().trim();
    setUserNameError('');
    
    if (normalizedUserName.length < 3) {
      setUserNameError('O USERNAME DEVE TER NO MÍNIMO 3 LETRAS');
      return;
    }

    if (normalizedUserName.length > 20) {
      setUserNameError('O USERNAME DEVE TER NO MÁXIMO 20 LETRAS');
      return;
    }

    // Valida caracteres permitidos (letras, números, underscore e hífen)
    if (!/^[A-Z0-9_-]+$/.test(normalizedUserName)) {
      setUserNameError('USE APENAS LETRAS, NÚMEROS, _ E -');
      return;
    }

    setIsCheckingUserName(true);
    const exists = await DataService.checkUserNameExists(normalizedUserName);
    setIsCheckingUserName(false);

    if (exists) {
      setUserNameError('ESTE USERNAME JÁ ESTÁ SENDO USADO');
      return;
    }

    setStep('fav-team');
  };

  const handleTeamNameSubmit = async () => {
    const normalizedName = teamName.toUpperCase().trim();
    setNameError('');
    
    if (normalizedName.length < 3) {
      setNameError('O NOME DEVE TER NO MÍNIMO 3 LETRAS');
      return;
    }

    if (RESERVED_NAMES.includes(normalizedName)) {
      setNameError('ESTE NOME É RESERVADO PARA TIMES OFICIAIS');
      return;
    }

    setIsCheckingName(true);
    const exists = await DataService.checkTeamNameExists(normalizedName);
    setIsCheckingName(false);

    if (exists) {
      setNameError('ESTE NOME JÁ ESTÁ SENDO USADO');
      return;
    }

    setStep('avatar');
  };

  const filteredChampions = useMemo(() => {
    return CHAMPIONS_LIST
      .filter(id => id.toLowerCase().includes(champSearch.toLowerCase()))
      .map(id => ({
        id,
        url: `https://ddragon.leagueoflegends.com/cdn/15.1.1/img/champion/${id}.png`
      }));
  }, [champSearch]);

  const renderProgress = () => {
    const steps = ['username', 'fav-team', 'team-name', 'avatar'];
    const currentIdx = steps.indexOf(step);
    return (
      <div className="w-full flex gap-2 px-10 mb-10">
        {steps.map((_, i) => (
          <div key={i} className={`h-1 flex-1 transition-all duration-500 ${i <= currentIdx ? 'bg-[#6366F1] shadow-[0_0_10px_rgba(94,108,255,0.5)]' : 'bg-white/10'}`}></div>
        ))}
      </div>
    );
  };

  const handleImageLoad = (id: string) => {
    setLoadedImages(prev => ({ ...prev, [id]: true }));
  };

  const fallbackLogo = "https://raw.githubusercontent.com/joaomdp/kingsfantasy/main/times/logo.png";

  return (
    <div className="fixed inset-0 z-[6000] bg-[#0B0411] flex flex-col items-center justify-center overflow-hidden font-inter">
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-b from-[#6366F1]/5 via-transparent to-transparent pointer-events-none"></div>

      {step === 'verify' && (
        <div className="w-full max-w-md p-10 space-y-12 animate-in fade-in relative z-10">
           <div className="text-center space-y-4">
             <h2 className="text-white font-orbitron font-black text-3xl uppercase tracking-tighter">VERIFICAÇÃO</h2>
             <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">DIGITE O CÓDIGO ENVIADO PARA<br/>{userEmail}</p>
           </div>
           <div className="flex justify-center gap-3">
             {code.map((digit, idx) => (
               <input key={idx} ref={el => inputRefs.current[idx] = el} type="text" maxLength={1} value={digit} onChange={e => handleCodeChange(idx, e.target.value)} className="w-14 h-20 bg-white/5 border border-white/10 rounded-2xl text-center text-3xl font-orbitron font-black text-white focus:outline-none focus:border-[#6366F1] transition-all shadow-inner" />
             ))}
           </div>
           <button onClick={() => setStep('username')} disabled={code.join('').length < 6} className="w-full py-6 bg-[#6366F1] text-black font-black text-sm uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_20px_50px_rgba(94,108,255,0.3)] disabled:opacity-20">CONECTAR</button>
        </div>
      )}

      {step === 'username' && (
        <div className="w-full max-w-md p-10 space-y-8 animate-in fade-in relative z-10">
          <div className="text-center space-y-4">
            <h2 className="text-white font-orbitron font-black text-3xl uppercase tracking-tighter">SEU USERNAME</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">ESCOLHA UM NOME ÚNICO PARA VOCÊ</p>
          </div>
          {renderProgress()}
          <div className="space-y-4">
            <input 
              type="text" 
              value={userName}
              onChange={(e) => {
                setUserName(e.target.value.toUpperCase());
                setUserNameError('');
              }}
              placeholder="DIGITE SEU USERNAME"
              maxLength={20}
              className={`w-full bg-white/5 border rounded-2xl py-5 px-6 text-center text-lg font-black text-white uppercase tracking-wider focus:outline-none transition-all shadow-inner placeholder:text-gray-700 ${
                userNameError ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-[#6366F1]'
              }`}
              autoFocus
            />
            {userNameError && (
              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                <p className="text-[10px] font-black text-red-500 uppercase text-center bg-red-500/10 py-3 px-4 rounded-xl border border-red-500/20">
                  {userNameError}
                </p>
              </div>
            )}
            <div className="text-center">
              <p className="text-[9px] text-gray-600 font-bold uppercase tracking-wide">
                Mínimo 3 caracteres • Use A-Z, 0-9, _ e -
              </p>
            </div>
          </div>
          <button 
            onClick={handleUserNameSubmit}
            disabled={isCheckingUserName || userName.trim().length < 3}
            className="w-full py-6 bg-[#6366F1] text-black font-black text-sm uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_20px_50px_rgba(94,108,255,0.3)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {isCheckingUserName ? 'VERIFICANDO...' : 'CONTINUAR'}
          </button>
        </div>
      )}

      {step === 'fav-team' && (
        <div className="w-full max-w-6xl flex flex-col items-center animate-in fade-in relative z-10 h-full pt-10">
          <div className="w-full max-w-4xl text-center mb-4 shrink-0 px-4">
            <h3 className="text-white text-[12px] font-bold uppercase tracking-[0.4em] mb-8">TIME FAVORITO</h3>
            {renderProgress()}
            <p className="text-gray-400 text-[14px] font-medium uppercase tracking-tight mb-8">PARA QUEM VOCÊ TORCE?</p>
          </div>
          
          {isLoadingTeams ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-12 h-12 border-4 border-[#6366F1]/20 border-t-[#6366F1] rounded-full animate-spin"></div>
              <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Sincronizando Banco de Dados...</span>
            </div>
          ) : (
            <div className="w-full flex-1 overflow-y-auto no-scrollbar px-6 pb-48">
               <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-x-6 gap-y-12 max-w-5xl mx-auto pt-6">
                {dbTeams.map(team => (
                  <button 
                    key={team.id}
                    ref={el => (teamButtonRefs.current[team.id] = el)}
                    onClick={() => setSelectedFavTeam(team)}
                    className="group relative flex flex-col items-center justify-start gap-4 transition-all duration-300 outline-none"
                  >
                    <div className={`relative w-20 h-20 md:w-24 md:h-24 transition-all duration-500 ease-out ${
                      selectedFavTeam?.id === team.id 
                        ? 'scale-110 z-10' 
                        : 'scale-100 opacity-60 grayscale group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105'
                    }`}>
                      <img 
                        src={team.logo} 
                        className={`w-full h-full object-contain transition-all duration-500 ${
                          selectedFavTeam?.id === team.id 
                           ? 'drop-shadow-[0_0_30px_rgba(94,108,255,0.8)]' 
                           : 'drop-shadow-none'
                        }`}
                        alt={team.name}
                        loading="eager"
                        onLoad={() => handleImageLoad(team.id)}
                        onError={(e) => { (e.target as HTMLImageElement).src = fallbackLogo; }}
                      />
                    </div>
                    <span className={`text-[10px] font-black uppercase tracking-wider text-center transition-all duration-300 line-clamp-1 max-w-full px-1 ${
                       selectedFavTeam?.id === team.id 
                       ? 'text-white text-shadow-glow' 
                       : 'text-gray-600 group-hover:text-gray-400'
                    }`}>
                      {team.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="fixed bottom-0 left-0 w-full p-8 md:p-10 bg-gradient-to-t from-[#0B0411] via-[#0B0411]/95 to-transparent z-50 pointer-events-none">
            <div className="max-w-md mx-auto pointer-events-auto">
              {selectedFavTeam && (
                <div className="flex items-center gap-4 bg-[#6366F1]/10 p-3 rounded-2xl border border-[#6366F1]/20 animate-in slide-in-from-bottom-4 mb-4 backdrop-blur-md">
                  <div className="w-8 h-8 flex items-center justify-center shrink-0">
                    <img src={selectedFavTeam.logo} className="w-full h-full object-contain drop-shadow-[0_0_5px_#6366F1]" alt="" onError={(e) => { (e.target as HTMLImageElement).src = fallbackLogo; }} />
                  </div>
                  <span className="text-white text-[10px] font-black uppercase tracking-widest truncate">TORCEDOR DA <span className="text-[#6366F1]">{selectedFavTeam.name}</span></span>
                </div>
              )}
              <button 
                disabled={!selectedFavTeam} 
                onClick={() => setStep('team-name')} 
                className="w-full py-5 bg-[#6366F1] text-black font-black text-sm uppercase tracking-widest rounded-2xl shadow-[0_20px_50px_rgba(94,108,255,0.25)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 disabled:grayscale hover:shadow-[0_20px_60px_rgba(94,108,255,0.4)]"
              >
                CONFIRMAR ESCOLHA
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'team-name' && (
        <div className="w-full max-w-2xl flex flex-col items-center animate-in slide-in-from-right-10 px-10">
          <div className="w-full text-center mb-16">
            <h3 className="text-white text-[12px] font-bold uppercase tracking-[0.4em] mb-10">IDENTIDADE</h3>
            {renderProgress()}
            <p className="text-gray-400 text-[14px] font-medium max-w-md mx-auto uppercase tracking-tight">QUAL SERÁ O NOME DO SEU TIME?</p>
          </div>

          <div className="w-full max-w-md space-y-6">
            <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest block text-left">NOME DO TIME</label>
            <div className="space-y-2">
              <input 
                type="text" 
                value={teamName}
                onChange={e => {
                  setTeamName(e.target.value.toUpperCase());
                  setNameError('');
                }}
                className={`w-full bg-white/5 border rounded-[2rem] p-6 text-white font-orbitron font-black text-xl text-center focus:outline-none transition-all shadow-inner ${nameError ? 'border-red-500' : 'border-white/10 focus:border-[#6366F1]'}`}
                placeholder="RANGERNATION"
                autoFocus
              />
              {nameError && (
                <p className="text-[10px] font-black text-red-500 text-center uppercase tracking-wider animate-in fade-in">{nameError}</p>
              )}
            </div>
          </div>

          <div className="fixed bottom-10 left-0 w-full px-10">
            <button 
              onClick={handleTeamNameSubmit} 
              disabled={!teamName || teamName.length < 3 || isCheckingName} 
              className="max-w-md mx-auto block w-full py-6 bg-[#6366F1] text-black font-black text-sm uppercase tracking-widest rounded-2xl shadow-[0_20px_40px_rgba(94,108,255,0.3)] transition-all disabled:opacity-20 flex items-center justify-center gap-3"
            >
              {isCheckingName ? (
                <>
                  <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                  VERIFICANDO...
                </>
              ) : (
                'PRÓXIMO'
              )}
            </button>
          </div>
        </div>
      )}

      {step === 'avatar' && (
        <div className="w-full max-w-5xl flex flex-col items-center animate-in fade-in h-full pt-20 relative z-10">
          <div className="w-full text-center mb-8 px-10 shrink-0">
            <h3 className="text-white text-[12px] font-bold uppercase tracking-[0.4em] mb-10">REPRESENTANTE</h3>
            {renderProgress()}
            <p className="text-gray-400 text-[14px] font-medium uppercase tracking-tight">ESCOLHA O CAMPEÃO QUE TE REPRESENTA</p>
          </div>

          <div className="w-full max-w-md px-10 mb-8 shrink-0">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-6 top-1/2 -translate-y-1/2 text-gray-700"></i>
              <input 
                type="text" 
                placeholder="BUSCAR LENDA..." 
                value={champSearch}
                onChange={e => setChampSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-14 pr-8 text-[11px] font-black text-white uppercase focus:outline-none focus:border-[#6366F1] transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto w-full px-10 no-scrollbar pb-40">
             <div className="grid grid-cols-4 md:grid-cols-10 gap-4">
                {filteredChampions.map(champ => (
                  <button key={champ.id} onClick={() => setSelectedAvatar(champ.url)} className={`aspect-square border-2 transition-all duration-500 rounded-3xl overflow-hidden ${selectedAvatar === champ.url ? 'border-[#6366F1] scale-110 shadow-[0_0_30px_rgba(94,108,255,0.4)] z-10' : 'border-white/5 grayscale opacity-30 hover:grayscale-0 hover:opacity-100 hover:border-white/20'}`}>
                    <img src={champ.url} className="w-full h-full object-cover" alt="" />
                  </button>
                ))}
             </div>
          </div>

          {selectedAvatar && (
            <div className="fixed bottom-0 left-0 w-full p-10 bg-[#0B0411]/90 backdrop-blur-xl border-t border-white/5 z-50">
              <button onClick={() => onComplete({ userName, teamName, avatar: selectedAvatar, favoriteTeam: selectedFavTeam?.name, shield: { shape: shieldShape, color: shieldColor, symbol: shieldSymbol } })} className="max-w-md mx-auto block w-full py-6 bg-[#6366F1] text-black font-black text-sm uppercase tracking-widest rounded-2xl shadow-[0_20px_60px_rgba(94,108,255,0.4)]">FINALIZAR ORGANIZAÇÃO</button>
            </div>
          )}
        </div>
      )}

    </div>
  );
};

export default OnboardingFlow;
