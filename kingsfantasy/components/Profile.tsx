
import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { UserTeam } from '../types';
import { CHAMPIONS_LIST } from '../constants';
import { DataService } from '../services/api';

interface ProfileProps {
  userTeam: UserTeam;
  onUpdate: (data: Partial<UserTeam>) => void;
  onLogout: () => void;
}

const Profile: React.FC<ProfileProps> = ({ userTeam, onUpdate, onLogout }) => {
  const [isChangingAvatar, setIsChangingAvatar] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isEditTeamModalOpen, setIsEditTeamModalOpen] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);
  const [champSearch, setChampSearch] = useState('');
  const [tempTeamName, setTempTeamName] = useState(userTeam.name);
  const [teamNameError, setTeamNameError] = useState<string | null>(null);
  const [isSavingTeamName, setIsSavingTeamName] = useState(false);

  const teamNameCooldownDays = (() => {
    if (!userTeam.teamNameChangedAt) return 0;
    const changedAt = new Date(userTeam.teamNameChangedAt).getTime();
    const cooldownMs = 30 * 24 * 60 * 60 * 1000;
    const elapsed = Date.now() - changedAt;
    if (elapsed >= cooldownMs) return 0;
    return Math.ceil((cooldownMs - elapsed) / (24 * 60 * 60 * 1000));
  })();
  const canChangeTeamName = teamNameCooldownDays === 0;
  const [currentLang, setCurrentLang] = useState<'PT' | 'EN'>('PT');
  const [formData, setFormData] = useState({
    name: userTeam.name,
    userName: userTeam.userName,
    avatar: userTeam.avatar,
  });

  // Sincroniza formData quando props mudam (ex: dados atualizados em outra tela)
  useEffect(() => {
    setFormData({
      name: userTeam.name,
      userName: userTeam.userName,
      avatar: userTeam.avatar,
    });
  }, [userTeam.name, userTeam.userName, userTeam.avatar]);

  const handleSaveAvatar = (url: string) => {
    setFormData(prev => ({ ...prev, avatar: url }));
    onUpdate({ avatar: url });
    setIsChangingAvatar(false);
    setChampSearch('');
  };

  const handleSaveTeamName = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmed = tempTeamName.trim();
    if (!trimmed) return;

    setIsSavingTeamName(true);
    setTeamNameError(null);

    const result = await DataService.updateTeamName(trimmed);
    setIsSavingTeamName(false);

    if (!result.ok) {
      setTeamNameError(result.error || 'Erro ao salvar nome.');
      return;
    }

    const saved = trimmed.toUpperCase();
    setFormData(prev => ({ ...prev, name: saved }));
    onUpdate({ name: saved, teamNameChangedAt: new Date().toISOString() });
    setIsEditTeamModalOpen(false);
  };

  const filteredChampions = useMemo(() => {
    return CHAMPIONS_LIST
      .filter(id => {
        const displayName = id === 'MonkeyKing' ? 'Wukong' : id;
        return displayName.toLowerCase().includes(champSearch.toLowerCase()) || id.toLowerCase().includes(champSearch.toLowerCase());
      })
      .map(id => ({
        id,
        name: id === 'MonkeyKing' ? 'Wukong' : id,
        url: `https://ddragon.leagueoflegends.com/cdn/15.1.1/img/champion/${id}.png`
      }));
  }, [champSearch]);

  const SettingItem = ({ icon, label, value, onClick, color = "text-gray-400", delay = "0" }: { icon: string, label: string, value?: string, onClick?: () => void, color?: string, delay?: string }) => (
    <div 
      onClick={onClick}
      className="flex items-center justify-between px-4 xs:px-5 sm:px-6 py-4 xs:py-5 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-300 cursor-pointer group border border-white/5 hover:border-white/10 rounded-lg xs:rounded-xl animate-in fade-in slide-in-from-bottom-4 fill-mode-both touch-manipulation min-h-[68px]"
      style={{ animationDelay: `${delay}ms`, animationDuration: '500ms' }}
    >
      <div className="flex items-center gap-3 xs:gap-4 flex-1 min-w-0">
        <div className={`w-10 h-10 xs:w-11 xs:h-11 bg-white/[0.03] border border-white/5 rounded-lg xs:rounded-xl flex items-center justify-center shrink-0 ${color} group-hover:scale-105 group-hover:bg-white/[0.08] transition-all duration-300`}>
          <i className={`fa-solid ${icon} text-sm xs:text-base group-hover:scale-110 transition-transform duration-300`}></i>
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-[10px] xs:text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-0.5 xs:mb-1">{label}</span>
          <span className="text-xs xs:text-sm font-bold text-white group-hover:text-[#3b82f6] transition-colors duration-300 truncate block">{value}</span>
        </div>
      </div>
      <div className="w-7 h-7 xs:w-8 xs:h-8 flex items-center justify-center group-hover:bg-white/[0.05] rounded-lg transition-all duration-300 shrink-0 ml-2">
        <i className="fa-solid fa-chevron-right text-[10px] xs:text-xs text-gray-600 group-hover:text-[#3b82f6] group-hover:translate-x-1 transition-all duration-300"></i>
      </div>
    </div>
  );

  const ModalBackdrop = ({ children, onClose }: { children?: React.ReactNode, onClose: () => void }) => createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 xs:p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative w-full flex items-center justify-center animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
        {children}
      </div>
    </div>,
    document.body
  );

  return (
    <div className="max-w-3xl mx-auto pb-24 xs:pb-28 sm:pb-32 overflow-visible px-3 xs:px-4 sm:px-6">
      
      {/* MODAL: LOGOUT */}
      {isLogoutModalOpen && (
        <ModalBackdrop onClose={() => setIsLogoutModalOpen(false)}>
          <div className="bg-[#0B0411]/95 backdrop-blur-xl border border-white/10 w-full max-w-sm p-6 xs:p-8 space-y-5 xs:space-y-6 shadow-2xl rounded-lg xs:rounded-xl">
            <div className="flex items-center gap-3 xs:gap-4">
              <div className="w-11 h-11 xs:w-12 xs:h-12 bg-red-500/10 flex items-center justify-center border border-red-500/20 rounded-lg xs:rounded-xl shrink-0">
                <i className="fa-solid fa-power-off text-lg xs:text-xl text-red-400"></i>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base xs:text-lg text-white">Sair da Conta</h3>
                <p className="text-[10px] xs:text-xs text-gray-500 mt-0.5">Você será desconectado</p>
              </div>
            </div>
            <div className="flex gap-2 xs:gap-3">
              <button onClick={() => setIsLogoutModalOpen(false)} className="flex-1 py-2.5 xs:py-3 bg-white/5 border border-white/10 rounded-lg xs:rounded-xl text-gray-400 text-[10px] xs:text-xs font-bold hover:bg-white/10 hover:text-white transition-all duration-300 touch-manipulation min-h-[44px]">
                Cancelar
              </button>
              <button onClick={onLogout} className="flex-1 py-2.5 xs:py-3 bg-red-500/90 rounded-lg xs:rounded-xl text-white text-[10px] xs:text-xs font-bold hover:bg-red-500 transition-all duration-300 touch-manipulation min-h-[44px]">
                Sair
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* MODAL: EDIT TEAM */}
      {isEditTeamModalOpen && (
        <ModalBackdrop onClose={() => { setIsEditTeamModalOpen(false); setTeamNameError(null); }}>
          <form onSubmit={handleSaveTeamName} className="bg-[#0B0411]/95 backdrop-blur-xl border border-white/10 w-full max-w-md p-6 xs:p-8 space-y-5 xs:space-y-6 shadow-2xl rounded-lg xs:rounded-xl">
            <div className="flex items-center gap-3 xs:gap-4">
              <div className={`w-11 h-11 xs:w-12 xs:h-12 flex items-center justify-center border rounded-lg xs:rounded-xl shrink-0 ${canChangeTeamName ? 'bg-[#3b82f6]/10 border-[#3b82f6]/20' : 'bg-amber-500/10 border-amber-500/20'}`}>
                <i className={`fa-solid text-lg xs:text-xl ${canChangeTeamName ? 'fa-shield-halved text-[#3b82f6]' : 'fa-clock text-amber-400'}`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base xs:text-lg text-white">Nome da Equipe</h3>
                <p className="text-[10px] xs:text-xs text-gray-500 mt-0.5">
                  {canChangeTeamName ? 'Altere a identidade do seu time' : `Disponível em ${teamNameCooldownDays} dia(s)`}
                </p>
              </div>
            </div>

            {!canChangeTeamName ? (
              <div className="bg-amber-500/8 border border-amber-500/20 rounded-xl p-4 space-y-1.5">
                <p className="text-amber-300 text-xs font-black uppercase tracking-wide">Troca bloqueada</p>
                <p className="text-amber-400/80 text-[11px] leading-relaxed">
                  O nome da equipe só pode ser alterado uma vez a cada 30 dias.<br />
                  Disponível novamente em <span className="font-black text-amber-300">{teamNameCooldownDays} dia(s)</span>.
                </p>
              </div>
            ) : (
              <div>
                <input
                  type="text"
                  value={tempTeamName}
                  onChange={(e) => { setTempTeamName(e.target.value.toUpperCase()); setTeamNameError(null); }}
                  className={`w-full bg-white/5 border rounded-lg xs:rounded-xl py-3 xs:py-3.5 px-3 xs:px-4 text-xs xs:text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.07] transition-all ${teamNameError ? 'border-red-500/50' : 'border-white/10'}`}
                  placeholder="DIGITE O NOME..."
                  maxLength={10}
                  autoFocus
                />
                <p className="text-[10px] text-gray-600 mt-1.5">3–10 caracteres · apenas letras e números</p>
                {teamNameError && <p className="text-red-400 text-[10px] xs:text-xs mt-2">{teamNameError}</p>}
              </div>
            )}

            <div className="flex gap-2 xs:gap-3">
              <button
                type="button"
                onClick={() => { setIsEditTeamModalOpen(false); setTeamNameError(null); }}
                className="flex-1 py-2.5 xs:py-3 bg-white/5 border border-white/10 rounded-lg xs:rounded-xl text-gray-400 text-[10px] xs:text-xs font-bold hover:bg-white/10 hover:text-white transition-all duration-300 touch-manipulation min-h-[44px]"
              >
                {canChangeTeamName ? 'Cancelar' : 'Fechar'}
              </button>
              {canChangeTeamName && (
                <button
                  type="submit"
                  disabled={isSavingTeamName || !tempTeamName.trim() || tempTeamName.trim().toUpperCase() === formData.name}
                  className="flex-1 py-2.5 xs:py-3 bg-[#3b82f6]/90 rounded-lg xs:rounded-xl text-white text-[10px] xs:text-xs font-bold hover:bg-[#3b82f6] transition-all duration-300 touch-manipulation min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSavingTeamName ? (
                    <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Salvando...</>
                  ) : 'Salvar'}
                </button>
              )}
            </div>
          </form>
        </ModalBackdrop>
      )}

      {/* MODAL: LANGUAGE */}
      {isLanguageModalOpen && (
        <ModalBackdrop onClose={() => setIsLanguageModalOpen(false)}>
          <div className="bg-[#0B0411]/95 backdrop-blur-xl border border-white/10 w-full max-w-sm p-6 xs:p-8 space-y-5 xs:space-y-6 shadow-2xl rounded-lg xs:rounded-xl">
            <div className="flex items-center gap-3 xs:gap-4">
              <div className="w-11 h-11 xs:w-12 xs:h-12 bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 rounded-lg xs:rounded-xl shrink-0">
                <i className="fa-solid fa-language text-lg xs:text-xl text-emerald-400"></i>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base xs:text-lg text-white">Idioma</h3>
                <p className="text-[10px] xs:text-xs text-gray-500 mt-0.5">Selecione sua preferência</p>
              </div>
            </div>
            <div className="space-y-2 xs:space-y-3">
              <button 
                onClick={() => { setCurrentLang('PT'); setIsLanguageModalOpen(false); }} 
                className={`w-full py-3 xs:py-3.5 px-3 xs:px-4 text-xs xs:text-sm font-bold transition-all duration-300 flex items-center gap-2 xs:gap-3 rounded-lg xs:rounded-xl touch-manipulation min-h-[48px] ${
                  currentLang === 'PT' 
                    ? 'bg-[#3b82f6]/90 text-white' 
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                <img src="https://flagcdn.com/w40/br.png" className="w-4 xs:w-5 h-auto shrink-0" alt="BR" /> 
                <span className="truncate">Português (Brasil)</span>
              </button>
              <button 
                onClick={() => { setCurrentLang('EN'); setIsLanguageModalOpen(false); }} 
                className={`w-full py-3 xs:py-3.5 px-3 xs:px-4 text-xs xs:text-sm font-bold transition-all duration-300 flex items-center gap-2 xs:gap-3 rounded-lg xs:rounded-xl touch-manipulation min-h-[48px] ${
                  currentLang === 'EN' 
                    ? 'bg-[#3b82f6]/90 text-white' 
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                <img src="https://flagcdn.com/w40/us.png" className="w-4 xs:w-5 h-auto shrink-0" alt="US" /> 
                <span className="truncate">English (US)</span>
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* MODAL: AVATAR SELECTOR */}
      {isChangingAvatar && (
        <ModalBackdrop onClose={() => setIsChangingAvatar(false)}>
          <div className="bg-[#0B0411]/95 backdrop-blur-xl border border-white/10 w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] rounded-lg xs:rounded-xl">
            <div className="p-4 xs:p-5 sm:p-6 border-b border-white/5 shrink-0 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 xs:gap-4 flex-1 min-w-0">
                <div className="w-9 h-9 xs:w-10 xs:h-10 bg-[#3b82f6]/10 flex items-center justify-center border border-[#3b82f6]/20 rounded-lg xs:rounded-xl shrink-0">
                  <i className="fa-solid fa-image text-sm xs:text-base text-[#3b82f6]"></i>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-base xs:text-lg text-white truncate">Escolher Avatar</h3>
                  <p className="text-[10px] xs:text-xs text-gray-500 mt-0.5 truncate">Selecione um campeão</p>
                </div>
              </div>
              <button onClick={() => setIsChangingAvatar(false)} className="w-9 h-9 xs:w-10 xs:h-10 flex items-center justify-center bg-white/5 border border-white/10 rounded-lg xs:rounded-xl text-gray-500 hover:text-white hover:bg-white/10 transition-all shrink-0 touch-manipulation">
                <i className="fa-solid fa-xmark text-base xs:text-lg"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 xs:p-5 sm:p-6 bg-black/20 custom-scrollbar">
              <div className="space-y-5 xs:space-y-6">
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-3 xs:left-4 top-1/2 -translate-y-1/2 text-gray-600 text-xs xs:text-sm"></i>
                  <input 
                    type="text" 
                    placeholder="Buscar campeão..." 
                    className="w-full bg-white/5 border border-white/10 rounded-lg xs:rounded-xl py-2.5 xs:py-3 pl-9 xs:pl-11 pr-3 xs:pr-4 text-xs xs:text-sm font-medium text-white placeholder:text-gray-600 focus:outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.07] transition-all" 
                    value={champSearch} 
                    onChange={(e) => setChampSearch(e.target.value)} 
                    autoFocus 
                  />
                </div>
                <div className="grid grid-cols-3 xs:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 xs:gap-3">
                  {filteredChampions.map((champ, index) => (
                    <button 
                      key={champ.id} 
                      onClick={() => handleSaveAvatar(champ.url)} 
                      className={`group relative aspect-square overflow-hidden border-2 rounded-lg xs:rounded-xl transition-all duration-300 animate-in fade-in zoom-in-95 fill-mode-both touch-manipulation ${
                        formData.avatar === champ.url 
                          ? 'border-[#3b82f6]/80 scale-105' 
                          : 'border-white/10 hover:border-white/30 hover:scale-105'
                      }`}
                      style={{ animationDelay: `${index * 20}ms`, animationDuration: '400ms' }}
                    >
                      <img 
                        src={champ.url} 
                        className={`w-full h-full object-cover transition-all duration-300 ${
                          formData.avatar === champ.url ? 'grayscale-0' : 'grayscale hover:grayscale-0'
                        }`} 
                        alt={champ.name} 
                      />
                      {formData.avatar === champ.url && (
                        <div className="absolute inset-0 bg-[#3b82f6]/20 flex items-center justify-center">
                          <i className="fa-solid fa-check text-white text-lg xs:text-xl"></i>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* PAGE CONTENT */}
      <div className="space-y-10 xs:space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both">
        
         {/* AVATAR HEADER - MINIMALISTA */}
         <div className="relative py-6 xs:py-8 px-3 xs:px-4 text-center">
           <div className="relative inline-block group mb-5 xs:mb-6 animate-in zoom-in-95 duration-500 fill-mode-both" onClick={() => setIsChangingAvatar(true)}>
             <div className="absolute inset-[-16px] xs:inset-[-20px] bg-[#3b82f6]/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
             <div className="relative w-28 h-28 xs:w-32 xs:h-32 sm:w-36 sm:h-36 overflow-hidden cursor-pointer border-2 border-white/10 rounded-xl xs:rounded-2xl group-hover:border-[#3b82f6]/50 transition-all duration-500 shadow-lg touch-manipulation">
                <img src={formData.avatar} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Avatar" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
                   <i className="fa-solid fa-camera text-white text-xl xs:text-2xl group-hover:scale-110 transition-transform duration-300"></i>
                </div>
             </div>
           </div>
           
           <div className="space-y-1.5 xs:space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both px-3">
             <h1 className="text-2xl xs:text-3xl sm:text-4xl font-orbitron font-black text-white uppercase tracking-tight truncate">{formData.userName}</h1>
             <p className="text-[10px] xs:text-xs font-bold text-gray-500 uppercase tracking-wider xs:tracking-widest truncate">{formData.name}</p>
           </div>
        </div>

        {/* SETTINGS LIST - MINIMALISTA */}
        <section className="space-y-5 xs:space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-both">
          <div className="px-3 xs:px-4">
            <h2 className="text-[10px] xs:text-xs font-bold text-gray-600 uppercase tracking-wider">Configurações</h2>
          </div>
          
          <div className="space-y-2 xs:space-y-3">
            <SettingItem
              icon={canChangeTeamName ? 'fa-shield-halved' : 'fa-lock'}
              label="NOME DA EQUIPE"
              value={canChangeTeamName ? formData.name : `${formData.name} · ${teamNameCooldownDays}d`}
              onClick={() => {
                setTempTeamName(formData.name);
                setTeamNameError(null);
                setIsEditTeamModalOpen(true);
              }}
              color={canChangeTeamName ? 'text-[#3b82f6]' : 'text-amber-400'}
              delay="0"
            />
            
            <SettingItem 
              icon="fa-user-circle" 
              label="ALTERAR AVATAR" 
              value="TROCAR IMAGEM" 
              onClick={() => setIsChangingAvatar(true)} 
              color="text-purple-400"
              delay="100"
            />

            <SettingItem
              icon="fa-language"
              label="IDIOMA"
              value="PORTUGUÊS (BR)"
              onClick={() => {}}
              color="text-emerald-400"
              delay="200"
            />

            <SettingItem 
              icon="fa-right-from-bracket" 
              label="SAIR DA CONTA" 
              value={formData.userName} 
              onClick={() => setIsLogoutModalOpen(true)} 
              color="text-red-400"
              delay="300"
            />
          </div>
        </section>

      </div>
    </div>
  );
};

export default Profile;
