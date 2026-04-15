import React, { useState, useRef, useMemo, useEffect } from 'react';
import { CHAMPIONS_LIST } from '../constants';
import { DataService } from '../services/api';
import { AuthService } from '../services/auth';
import { useToast } from './Toast';

interface OnboardingFlowProps {
  onComplete: (data: { userName: string; teamName: string; avatar: string; favoriteTeam: string; shield: any }) => void;
}

const SHIELD_SHAPES = ['fa-shield', 'fa-shield-halved', 'fa-shield-heart', 'fa-certificate', 'fa-clapperboard'];
const SHIELD_SYMBOLS = ['fa-bolt', 'fa-fire', 'fa-crown', 'fa-skull', 'fa-dragon', 'fa-ghost', 'fa-hand-fist'];
const COLORS = ['#FFFFFF', '#3b82f6', '#FFB800', '#00FF94', '#00E0FF', '#FF4655', '#B05EFF', '#FF5EB0'];

const RESERVED_NAMES = ["T1", "LOUD", "PAIN", "FURIA", "FLUXO", "RED CANIDS", "KABUM", "INTZ", "LOS GRANDES", "ITAFANTASY", "LIBERTY", "VIVO KEYD", "KEYD"];

const STEP_CONFIG = [
  { key: 'username',  icon: 'fa-user',        label: 'Invocador'  },
  { key: 'fav-team',  icon: 'fa-shield-heart', label: 'Torcida'    },
  { key: 'team-name', icon: 'fa-pen',          label: 'Time'       },
  { key: 'avatar',    icon: 'fa-star',         label: 'Lenda'      },
];

const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const { showToast } = useToast();

  const [step, setStep] = useState<'email-verify' | 'username' | 'fav-team' | 'team-name' | 'avatar'>('email-verify');

  // Email verification
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpExpiry, setOtpExpiry] = useState(0); // countdown in seconds until code expires
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [userName, setUserName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [dbTeams, setDbTeams] = useState<{id: string, name: string, logo: string}[]>([]);
  const [selectedFavTeam, setSelectedFavTeam] = useState<any>(null);
  const [selectedAvatar, setSelectedAvatar] = useState('');

  const [userNameError, setUserNameError] = useState('');
  const [isCheckingUserName, setIsCheckingUserName] = useState(false);
  const [userNameSuggestions, setUserNameSuggestions] = useState<string[]>([]);
  const [nameError, setNameError] = useState('');
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [teamNameSuggestions, setTeamNameSuggestions] = useState<string[]>([]);

  const [champSearch, setChampSearch] = useState('');
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [shieldShape, setShieldShape] = useState(SHIELD_SHAPES[0]);
  const [shieldColor, setShieldColor] = useState('#3b82f6');
  const [shieldSymbol, setShieldSymbol] = useState(SHIELD_SYMBOLS[2]);

  const teamButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    const fetchTeams = async () => {
      setIsLoadingTeams(true);
      const teams = await DataService.getTeams();
      setDbTeams(teams);
      setIsLoadingTeams(false);
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
        buttonElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 150);
    }
  }, [selectedFavTeam]);

  // Auto-send OTP when component mounts + cleanup on unmount
  useEffect(() => {
    sendOtp();
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      if (expiryRef.current) clearInterval(expiryRef.current);
    };
  }, []);

  const startCooldown = () => {
    setResendCooldown(60);
    cooldownRef.current = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(cooldownRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const startExpiryTimer = () => {
    if (expiryRef.current) clearInterval(expiryRef.current);
    setOtpExpiry(120); // 2 minutes
    expiryRef.current = setInterval(() => {
      setOtpExpiry(prev => {
        if (prev <= 1) { clearInterval(expiryRef.current!); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const sendOtp = async () => {
    const email = AuthService.getSession()?.user?.email;
    if (!email) return;
    setIsSendingOtp(true);
    setOtpError('');
    const result = await DataService.sendEmailOtp(email);
    setIsSendingOtp(false);
    if (result.ok) {
      setOtpSent(true);
      setOtpCode(['', '', '', '', '', '']);
      setOtpError('');
      startCooldown();
      startExpiryTimer();
    } else {
      setOtpError(result.error || 'Erro ao enviar código.');
    }
  };

  const handleOtpInput = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newCode = [...otpCode];
    newCode[index] = digit;
    setOtpCode(newCode);
    setOtpError('');
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    // Auto-submit when all filled
    if (digit && index === 5) {
      const fullCode = [...newCode].join('');
      if (fullCode.length === 6) verifyOtp(fullCode);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpCode[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const newCode = Array(6).fill('').map((_, i) => pasted[i] || '');
    setOtpCode(newCode);
    setOtpError('');
    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
    if (pasted.length === 6) verifyOtp(pasted);
  };

  const verifyOtp = async (code?: string) => {
    const finalCode = code || otpCode.join('');
    if (finalCode.length < 6) return;
    const email = AuthService.getSession()?.user?.email;
    if (!email) return;
    setIsVerifyingOtp(true);
    setOtpError('');
    const result = await DataService.verifyEmailOtp(email, finalCode);
    setIsVerifyingOtp(false);
    if (result.ok) {
      setStep('username');
    } else {
      setOtpError(result.error?.toUpperCase() || 'CÓDIGO INVÁLIDO OU EXPIRADO');
      setOtpCode(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    }
  };

  const generateSuggestions = async (base: string): Promise<string[]> => {
    const suffixes = ['1', '2', '99', '7', '10', 'X', 'BR', 'GG', 'PRO'];
    const prefixes = ['X', 'MR', 'DR', 'THE'];
    const candidates: string[] = [];

    // suffix variants
    for (const s of suffixes) {
      const candidate = (base + s).slice(0, 10);
      if (candidate !== base && candidate.length >= 3) candidates.push(candidate);
    }
    // prefix variants (only if base is short enough)
    for (const p of prefixes) {
      const candidate = (p + base).slice(0, 10);
      if (candidate !== base && candidate.length >= 3) candidates.push(candidate);
    }

    const available: string[] = [];
    for (const c of candidates) {
      if (available.length >= 3) break;
      const taken = await DataService.checkUserNameExists(c);
      if (!taken) available.push(c);
    }
    return available;
  };

  const handleUserNameSubmit = async () => {
    const normalizedUserName = userName.toUpperCase().trim();
    setUserNameError('');
    setUserNameSuggestions([]);

    if (normalizedUserName.length < 3) {
      setUserNameError('O USERNAME DEVE TER NO MÍNIMO 3 CARACTERES');
      return;
    }
    if (normalizedUserName.length > 10) {
      setUserNameError('O USERNAME DEVE TER NO MÁXIMO 10 CARACTERES');
      return;
    }
    if (!/^[A-Z0-9]+$/.test(normalizedUserName)) {
      setUserNameError('USE APENAS LETRAS E NÚMEROS, SEM ESPAÇOS');
      return;
    }

    setIsCheckingUserName(true);
    const exists = await DataService.checkUserNameExists(normalizedUserName);

    if (exists) {
      const suggestions = await generateSuggestions(normalizedUserName);
      setIsCheckingUserName(false);
      setUserNameError('ESTE USERNAME JÁ ESTÁ SENDO USADO');
      setUserNameSuggestions(suggestions);
      return;
    }

    setIsCheckingUserName(false);
    setStep('fav-team');
  };

  const generateTeamNameSuggestions = async (base: string): Promise<string[]> => {
    const suffixes = ['1', '2', 'GG', 'BR', 'X', 'PRO', 'WIN'];
    const prefixes = ['X', 'GO', 'TOP'];
    const candidates: string[] = [];

    for (const s of suffixes) {
      const candidate = (base + s).slice(0, 10);
      if (candidate !== base && candidate.length >= 3) candidates.push(candidate);
    }
    for (const p of prefixes) {
      const candidate = (p + base).slice(0, 10);
      if (candidate !== base && candidate.length >= 3) candidates.push(candidate);
    }

    const available: string[] = [];
    for (const c of candidates) {
      if (available.length >= 3) break;
      const taken = await DataService.checkTeamNameExists(c);
      if (!taken) available.push(c);
    }
    return available;
  };

  const handleTeamNameSubmit = async () => {
    const normalizedName = teamName.toUpperCase().trim();
    setNameError('');
    setTeamNameSuggestions([]);

    if (normalizedName.length < 3) {
      setNameError('O NOME DEVE TER NO MÍNIMO 3 LETRAS');
      return;
    }
    if (normalizedName.length > 10) {
      setNameError('O NOME DEVE TER NO MÁXIMO 10 CARACTERES');
      return;
    }
    if (RESERVED_NAMES.includes(normalizedName)) {
      setNameError('ESTE NOME É RESERVADO PARA TIMES OFICIAIS');
      return;
    }

    setIsCheckingName(true);
    const exists = await DataService.checkTeamNameExists(normalizedName);

    if (exists) {
      const suggestions = await generateTeamNameSuggestions(normalizedName);
      setIsCheckingName(false);
      setNameError('ESTE NOME JÁ ESTÁ SENDO USADO');
      setTeamNameSuggestions(suggestions);
      return;
    }

    setIsCheckingName(false);
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

  const handleImageLoad = (id: string) => {
    setLoadedImages(prev => ({ ...prev, [id]: true }));
  };

  const fallbackLogo = "https://raw.githubusercontent.com/joaomdp/kingsfantasy/main/times/logo.png";

  const handleFinalSubmit = async () => {
    setIsSubmitting(true);

    const userExists = await DataService.checkUserNameExists(userName.toUpperCase().trim());
    if (userExists) {
      const suggestions = await generateSuggestions(userName.toUpperCase().trim());
      setIsSubmitting(false);
      setUserNameSuggestions(suggestions);
      setUserNameError('ESTE USERNAME JÁ ESTÁ SENDO USADO');
      setStep('username');
      showToast('Username já cadastrado. Escolha outro.', 'error');
      return;
    }

    const teamExists = await DataService.checkTeamNameExists(teamName.toUpperCase().trim());
    if (teamExists) {
      const suggestions = await generateTeamNameSuggestions(teamName.toUpperCase().trim());
      setIsSubmitting(false);
      setTeamNameSuggestions(suggestions);
      setNameError('ESTE NOME JÁ ESTÁ SENDO USADO');
      setStep('team-name');
      showToast('Nome do time já cadastrado. Escolha outro.', 'error');
      return;
    }

    setIsSubmitting(false);
    onComplete({
      userName,
      teamName,
      avatar: selectedAvatar,
      favoriteTeam: selectedFavTeam?.name,
      shield: { shape: shieldShape, color: shieldColor, symbol: shieldSymbol }
    });
  };

  const currentStepIdx = STEP_CONFIG.findIndex(s => s.key === step);

  const renderProgress = () => (
    <div className="flex items-center justify-center gap-0 mb-8 sm:mb-10">
      {STEP_CONFIG.map((s, i) => {
        const done = i < currentStepIdx;
        const active = i === currentStepIdx;
        return (
          <React.Fragment key={s.key}>
            <div className="flex flex-col items-center gap-1.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 text-[10px] ${
                active  ? 'bg-[#3b82f6] text-black shadow-[0_0_16px_rgba(59,130,246,0.6)]' :
                done    ? 'bg-[#3b82f6]/20 text-[#3b82f6] border border-[#3b82f6]/40' :
                          'bg-white/5 text-gray-600 border border-white/10'
              }`}>
                {done
                  ? <i className="fa-solid fa-check text-[9px]"></i>
                  : <i className={`fa-solid ${s.icon} text-[9px]`}></i>
                }
              </div>
              <span className={`text-[8px] font-black uppercase tracking-widest transition-colors duration-300 hidden sm:block ${
                active ? 'text-[#3b82f6]' : done ? 'text-[#3b82f6]/50' : 'text-gray-700'
              }`}>{s.label}</span>
            </div>
            {i < STEP_CONFIG.length - 1 && (
              <div className={`h-px w-8 sm:w-12 mx-1 transition-all duration-500 ${i < currentStepIdx ? 'bg-[#3b82f6]/40' : 'bg-white/10'}`}></div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[6000] bg-[#08090e] flex flex-col items-center justify-center overflow-y-auto min-h-[100dvh] font-inter">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#3b82f6]/8 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#3b82f6]/4 blur-[150px] rounded-full"></div>
      </div>

      {/* EMAIL VERIFY */}
      {step === 'email-verify' && (
        <div className="w-full max-w-xs px-6 sm:px-0 flex flex-col items-center gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">

          {/* Logo + título */}
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 bg-[#3b82f6] rounded-full flex items-center justify-center shadow-[0_0_24px_rgba(59,130,246,0.5)]">
              <i className="fa-solid fa-envelope text-white text-base"></i>
            </div>
            <div className="text-center">
              <h2 className="text-white font-orbitron font-black text-xl uppercase tracking-tight">
                Código de Acesso
              </h2>
              <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
                {isSendingOtp
                  ? 'Enviando código...'
                  : otpSent
                    ? <>Enviamos para <span className="text-gray-300">{AuthService.getSession()?.user?.email}</span></>
                    : 'Preparando envio...'
                }
              </p>
            </div>
          </div>

          {/* OTP inputs */}
          <div className="flex gap-2.5 justify-center" onPaste={handleOtpPaste}>
            {otpCode.map((digit, i) => (
              <input
                key={i}
                ref={el => (otpRefs.current[i] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleOtpInput(i, e.target.value)}
                onKeyDown={e => handleOtpKeyDown(i, e)}
                className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-2xl font-black text-white bg-transparent border-b-2 focus:outline-none transition-all ${
                  otpError
                    ? 'border-red-500/60 text-red-400'
                    : digit
                      ? 'border-[#3b82f6] text-[#3b82f6]'
                      : 'border-white/20 focus:border-[#3b82f6]'
                }`}
                disabled={isVerifyingOtp}
              />
            ))}
          </div>

          {/* Mensagens */}
          <div className="w-full space-y-2 text-center">
            {otpSent && otpExpiry > 0 && (
              <p className={`text-[11px] font-medium ${otpExpiry <= 30 ? 'text-amber-400' : 'text-gray-600'}`}>
                Expira em{' '}
                <span className={otpExpiry <= 30 ? 'text-amber-300 font-black' : 'text-gray-400 font-black'}>
                  {Math.floor(otpExpiry / 60)}:{String(otpExpiry % 60).padStart(2, '0')}
                </span>
              </p>
            )}
            {otpSent && otpExpiry === 0 && (
              <p className="text-[11px] text-red-400 font-medium">Código expirado — solicite um novo</p>
            )}
            {otpError && (
              <p className="text-[11px] text-red-400 font-medium animate-in fade-in duration-200">{otpError}</p>
            )}
          </div>

          {/* Botão confirmar */}
          <button
            onClick={() => verifyOtp()}
            disabled={otpCode.join('').length < 6 || isVerifyingOtp || otpExpiry === 0}
            className="w-full py-3.5 bg-[#3b82f6] text-white font-black text-xs uppercase tracking-widest rounded-xl hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-30 flex items-center justify-center gap-2"
          >
            {isVerifyingOtp ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : 'Confirmar'}
          </button>

          {/* Reenviar */}
          <div className="text-center -mt-4">
            {resendCooldown > 0 ? (
              <p className="text-[11px] text-gray-600">
                Reenviar em <span className="text-gray-400 font-black">{resendCooldown}s</span>
              </p>
            ) : (
              <button
                onClick={sendOtp}
                disabled={isSendingOtp}
                className="text-[11px] text-gray-500 hover:text-[#3b82f6] transition-colors disabled:opacity-40"
              >
                {isSendingOtp ? 'Enviando...' : 'Não recebi o código'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* USERNAME */}
      {step === 'username' && (
        <div className="w-full max-w-sm px-6 sm:px-0 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
          {renderProgress()}

          <div className="text-center space-y-2 mb-8">
            <div className="w-14 h-14 bg-[#3b82f6]/10 border border-[#3b82f6]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-user text-[#3b82f6] text-xl"></i>
            </div>
            <h2 className="text-white font-orbitron font-black text-2xl sm:text-3xl uppercase tracking-tight">
              Seu Invocador
            </h2>
            <p className="text-gray-500 text-xs font-medium">
              Como você será conhecido na arena
            </p>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={userName}
                onChange={(e) => {
                  const filtered = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  setUserName(filtered);
                  setUserNameError('');
                  setUserNameSuggestions([]);
                }}
                placeholder="INVOCADOR123"
                maxLength={10}
                className={`w-full bg-white/5 border rounded-2xl py-4 px-5 pr-16 text-center text-lg font-black text-white uppercase tracking-widest focus:outline-none transition-all ${
                  userNameError
                    ? 'border-red-500/50 bg-red-500/5 focus:border-red-500'
                    : 'border-white/10 focus:border-[#3b82f6] focus:bg-[#3b82f6]/5'
                }`}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleUserNameSubmit()}
              />
              <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black tabular-nums ${
                userName.length >= 10 ? 'text-[#3b82f6]' : 'text-gray-600'
              }`}>
                {userName.length}/10
              </span>
            </div>

            {userNameError ? (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <i className="fa-solid fa-circle-exclamation text-red-400 text-xs shrink-0"></i>
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-wide">{userNameError}</p>
                </div>
                {userNameSuggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest text-center">
                      Disponíveis para você:
                    </p>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {userNameSuggestions.map(s => (
                        <button
                          key={s}
                          onClick={() => {
                            setUserName(s);
                            setUserNameError('');
                            setUserNameSuggestions([]);
                          }}
                          className="px-4 py-2 bg-[#3b82f6]/10 border border-[#3b82f6]/30 hover:bg-[#3b82f6]/20 hover:border-[#3b82f6]/60 rounded-xl text-[11px] font-black text-[#3b82f6] uppercase tracking-wider transition-all touch-manipulation active:scale-95"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-[10px] text-gray-700 font-medium">
                3–10 caracteres · apenas letras e números
              </p>
            )}
          </div>

          <button
            onClick={handleUserNameSubmit}
            disabled={isCheckingUserName || userName.trim().length < 3}
            className="w-full py-4 bg-[#3b82f6] text-black font-black text-sm uppercase tracking-widest rounded-2xl hover:scale-[1.02] active:scale-95 transition-all shadow-[0_12px_40px_rgba(59,130,246,0.3)] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {isCheckingUserName ? (
              <>
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                VERIFICANDO...
              </>
            ) : (
              <>
                CONTINUAR
                <i className="fa-solid fa-arrow-right text-xs"></i>
              </>
            )}
          </button>
        </div>
      )}

      {/* FAV TEAM */}
      {step === 'fav-team' && (
        <div className="w-full max-w-5xl flex flex-col items-center animate-in fade-in duration-500 relative z-10 h-[100dvh] pt-8 sm:pt-10">
          <div className="w-full px-4 sm:px-6 shrink-0">
            {renderProgress()}
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-[#3b82f6]/10 border border-[#3b82f6]/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <i className="fa-solid fa-shield-heart text-[#3b82f6] text-lg"></i>
              </div>
              <h2 className="text-white font-orbitron font-black text-xl sm:text-2xl uppercase tracking-tight mb-1">
                Seu Time do Coração
              </h2>
              <p className="text-gray-500 text-xs font-medium">Para quem você torce?</p>
            </div>
          </div>

          {isLoadingTeams ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-2 border-[#3b82f6]/20 border-t-[#3b82f6] rounded-full animate-spin"></div>
              <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Carregando times...</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto w-full no-scrollbar px-4 sm:px-8 pb-36">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-5 max-w-4xl mx-auto py-2">
                {dbTeams.map(team => {
                  const isSelected = selectedFavTeam?.id === team.id;
                  return (
                    <button
                      key={team.id}
                      ref={el => (teamButtonRefs.current[team.id] = el)}
                      onClick={() => setSelectedFavTeam(team)}
                      className={`group flex flex-col items-center gap-2.5 p-3 rounded-2xl border transition-all duration-300 outline-none touch-manipulation ${
                        isSelected
                          ? 'border-[#3b82f6]/50 bg-[#3b82f6]/10 shadow-[0_0_20px_rgba(59,130,246,0.2)]'
                          : 'border-white/5 bg-white/2 hover:border-white/15 hover:bg-white/5'
                      }`}
                    >
                      <div className={`w-12 h-12 sm:w-14 sm:h-14 transition-all duration-300 ${isSelected ? 'scale-110' : 'opacity-50 grayscale group-hover:grayscale-0 group-hover:opacity-90 group-hover:scale-105'}`}>
                        <img
                          src={team.logo}
                          className={`w-full h-full object-contain ${isSelected ? 'drop-shadow-[0_0_12px_rgba(59,130,246,0.8)]' : ''}`}
                          alt={team.name}
                          loading="eager"
                          onLoad={() => handleImageLoad(team.id)}
                          onError={(e) => { (e.target as HTMLImageElement).src = fallbackLogo; }}
                        />
                      </div>
                      <span className={`text-[9px] font-black uppercase tracking-wide text-center line-clamp-1 w-full transition-colors duration-300 ${
                        isSelected ? 'text-[#3b82f6]' : 'text-gray-600 group-hover:text-gray-400'
                      }`}>
                        {team.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="fixed bottom-0 left-0 w-full px-4 sm:px-6 pb-6 pt-4 bg-gradient-to-t from-[#08090e] via-[#08090e]/95 to-transparent z-50">
            <div className="max-w-sm mx-auto space-y-3">
              {selectedFavTeam && (
                <div className="flex items-center gap-3 bg-[#3b82f6]/10 px-4 py-3 rounded-2xl border border-[#3b82f6]/20 animate-in slide-in-from-bottom-2 duration-300">
                  <img src={selectedFavTeam.logo} className="w-7 h-7 object-contain drop-shadow-[0_0_6px_#3b82f6]" alt="" onError={(e) => { (e.target as HTMLImageElement).src = fallbackLogo; }} />
                  <span className="text-white text-[10px] font-black uppercase tracking-widest">
                    Torcedor da <span className="text-[#3b82f6]">{selectedFavTeam.name}</span>
                  </span>
                </div>
              )}
              <button
                disabled={!selectedFavTeam}
                onClick={() => setStep('team-name')}
                className="w-full py-4 bg-[#3b82f6] text-black font-black text-sm uppercase tracking-widest rounded-2xl shadow-[0_12px_40px_rgba(59,130,246,0.25)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                CONFIRMAR
                <i className="fa-solid fa-arrow-right text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TEAM NAME */}
      {step === 'team-name' && (
        <div className="w-full max-w-sm px-6 sm:px-0 animate-in fade-in slide-in-from-bottom-4 duration-500 relative z-10">
          {renderProgress()}

          <div className="text-center space-y-2 mb-8">
            <div className="w-14 h-14 bg-[#3b82f6]/10 border border-[#3b82f6]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <i className="fa-solid fa-pen text-[#3b82f6] text-xl"></i>
            </div>
            <h2 className="text-white font-orbitron font-black text-2xl sm:text-3xl uppercase tracking-tight">
              Nome do Time
            </h2>
            <p className="text-gray-500 text-xs font-medium">
              Como sua org será conhecida
            </p>
          </div>

          <div className="space-y-3">
            <div className="relative">
              <input
                type="text"
                value={teamName}
                onChange={e => {
                  const filtered = e.target.value.toUpperCase().slice(0, 10);
                  setTeamName(filtered);
                  setNameError('');
                  setTeamNameSuggestions([]);
                }}
                className={`w-full bg-white/5 border rounded-2xl py-4 px-5 pr-16 text-center font-orbitron font-black text-xl text-white uppercase focus:outline-none transition-all tracking-wide ${
                  nameError
                    ? 'border-red-500/50 bg-red-500/5 focus:border-red-500'
                    : 'border-white/10 focus:border-[#3b82f6] focus:bg-[#3b82f6]/5'
                }`}
                placeholder="RANGERNATION"
                maxLength={10}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleTeamNameSubmit()}
              />
              <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black tabular-nums ${
                teamName.length >= 10 ? 'text-[#3b82f6]' : 'text-gray-600'
              }`}>
                {teamName.length}/10
              </span>
            </div>

            {nameError ? (
              <div className="space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                  <i className="fa-solid fa-circle-exclamation text-red-400 text-xs shrink-0"></i>
                  <p className="text-[10px] font-black text-red-400 uppercase tracking-wide">{nameError}</p>
                </div>
                {teamNameSuggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest text-center">
                      Disponíveis para você:
                    </p>
                    <div className="flex gap-2 justify-center flex-wrap">
                      {teamNameSuggestions.map(s => (
                        <button
                          key={s}
                          onClick={() => {
                            setTeamName(s);
                            setNameError('');
                            setTeamNameSuggestions([]);
                          }}
                          className="px-4 py-2 bg-[#3b82f6]/10 border border-[#3b82f6]/30 hover:bg-[#3b82f6]/20 hover:border-[#3b82f6]/60 rounded-xl text-[11px] font-black text-[#3b82f6] uppercase tracking-wider transition-all touch-manipulation active:scale-95"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-[10px] text-gray-700 font-medium">3–10 caracteres</p>
            )}
          </div>

          <button
            onClick={handleTeamNameSubmit}
            disabled={!teamName || teamName.length < 3 || teamName.length > 10 || isCheckingName}
            className="w-full mt-6 py-4 bg-[#3b82f6] text-black font-black text-sm uppercase tracking-widest rounded-2xl shadow-[0_12px_40px_rgba(59,130,246,0.3)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-30 disabled:hover:scale-100 flex items-center justify-center gap-2"
          >
            {isCheckingName ? (
              <>
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                VERIFICANDO...
              </>
            ) : (
              <>
                PRÓXIMO
                <i className="fa-solid fa-arrow-right text-xs"></i>
              </>
            )}
          </button>
        </div>
      )}

      {/* AVATAR */}
      {step === 'avatar' && (
        <div className="w-full max-w-5xl flex flex-col items-center animate-in fade-in duration-500 relative z-10 h-[100dvh] pt-8 sm:pt-10">
          <div className="w-full px-4 sm:px-6 shrink-0">
            {renderProgress()}
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-[#3b82f6]/10 border border-[#3b82f6]/20 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <i className="fa-solid fa-star text-[#3b82f6] text-lg"></i>
              </div>
              <h2 className="text-white font-orbitron font-black text-xl sm:text-2xl uppercase tracking-tight mb-1">
                Sua Lenda
              </h2>
              <p className="text-gray-500 text-xs font-medium">Escolha o campeão que te representa</p>
            </div>

            <div className="relative max-w-xs mx-auto mb-4">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-xs"></i>
              <input
                type="text"
                placeholder="Buscar lenda..."
                value={champSearch}
                onChange={e => setChampSearch(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-xs font-bold text-white uppercase focus:outline-none focus:border-[#3b82f6] transition-all"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto w-full no-scrollbar px-4 sm:px-8 pb-32">
            <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 gap-2 sm:gap-3 max-w-4xl mx-auto py-1">
              {filteredChampions.map(champ => {
                const isSelected = selectedAvatar === champ.url;
                return (
                  <button
                    key={champ.id}
                    onClick={() => setSelectedAvatar(champ.url)}
                    className={`aspect-square rounded-xl overflow-hidden border-2 transition-all duration-300 touch-manipulation ${
                      isSelected
                        ? 'border-[#3b82f6] scale-110 shadow-[0_0_20px_rgba(59,130,246,0.5)] z-10'
                        : 'border-white/5 opacity-40 grayscale hover:opacity-90 hover:grayscale-0 hover:border-white/20 hover:scale-105'
                    }`}
                  >
                    <img src={champ.url} className="w-full h-full object-cover" alt={champ.id} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`fixed bottom-0 left-0 w-full px-4 sm:px-6 pb-6 pt-4 z-50 transition-all duration-300 ${
            selectedAvatar ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
          } bg-gradient-to-t from-[#08090e] via-[#08090e]/95 to-transparent`}>
            <div className="max-w-sm mx-auto space-y-3">
              {selectedAvatar && (
                <div className="flex items-center gap-3 bg-[#3b82f6]/10 px-4 py-3 rounded-2xl border border-[#3b82f6]/20">
                  <img src={selectedAvatar} className="w-8 h-8 object-cover rounded-lg border border-[#3b82f6]/40" alt="" />
                  <span className="text-white text-[10px] font-black uppercase tracking-widest">
                    Lenda selecionada
                  </span>
                </div>
              )}
              <button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="w-full py-4 bg-[#3b82f6] text-black font-black text-sm uppercase tracking-widest rounded-2xl shadow-[0_12px_40px_rgba(59,130,246,0.4)] hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></span>
                    VERIFICANDO...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-crown text-xs"></i>
                    ENTRAR NO KINGS
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnboardingFlow;
