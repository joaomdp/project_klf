
import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { UserTeam } from '../types';
import { CHAMPIONS_LIST } from '../constants';

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
  const [currentLang, setCurrentLang] = useState<'PT' | 'EN'>('PT');
  const [formData, setFormData] = useState({
    name: userTeam.name,
    userName: userTeam.userName,
    avatar: userTeam.avatar,
  });

  const handleSaveAvatar = (url: string) => {
    setFormData(prev => ({ ...prev, avatar: url }));
    onUpdate({ avatar: url });
    setIsChangingAvatar(false);
    setChampSearch('');
  };

  const handleSaveTeamName = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const lowerName = tempTeamName.toLowerCase().trim();
    if (!lowerName) return;

    const reservedTeams = ["t1", "loud", "pain", "furia", "fluxo", "red canids", "kabum", "intz", "los grandes", "itafantasy"];

    if (reservedTeams.includes(lowerName) && lowerName !== userTeam.name.toLowerCase()) {
      setTeamNameError("Este nome de time é reservado e não pode ser utilizado.");
      return;
    }
    setTeamNameError(null);

    setFormData(prev => ({ ...prev, name: tempTeamName }));
    onUpdate({ name: tempTeamName });
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
      className="flex items-center justify-between px-6 py-5 bg-white/[0.02] hover:bg-white/[0.05] transition-all duration-300 cursor-pointer group border border-white/5 hover:border-white/10 animate-in fade-in slide-in-from-bottom-4 fill-mode-both"
      style={{ animationDelay: `${delay}ms`, animationDuration: '500ms' }}
    >
      <div className="flex items-center gap-4">
        <div className={`w-11 h-11 bg-white/[0.03] border border-white/5 flex items-center justify-center ${color} group-hover:scale-105 group-hover:bg-white/[0.08] transition-all duration-300`}>
          <i className={`fa-solid ${icon} text-base group-hover:scale-110 transition-transform duration-300`}></i>
        </div>
        <div>
          <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1">{label}</span>
          <span className="text-sm font-bold text-white group-hover:text-[#6366F1] transition-colors duration-300">{value}</span>
        </div>
      </div>
      <div className="w-8 h-8 flex items-center justify-center group-hover:bg-white/[0.05] transition-all duration-300">
        <i className="fa-solid fa-chevron-right text-xs text-gray-600 group-hover:text-[#6366F1] group-hover:translate-x-1 transition-all duration-300"></i>
      </div>
    </div>
  );

  const ModalBackdrop = ({ children, onClose }: { children?: React.ReactNode, onClose: () => void }) => createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="absolute inset-0" onClick={onClose}></div>
      <div className="relative w-full flex items-center justify-center animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
        {children}
      </div>
    </div>,
    document.body
  );

  return (
    <div className="max-w-3xl mx-auto pb-32 overflow-visible">
      
      {/* MODAL: LOGOUT */}
      {isLogoutModalOpen && (
        <ModalBackdrop onClose={() => setIsLogoutModalOpen(false)}>
          <div className="bg-[#0B0411]/95 backdrop-blur-xl border border-white/10 w-full max-w-sm p-8 space-y-6 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <i className="fa-solid fa-power-off text-xl text-red-400"></i>
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Sair da Conta</h3>
                <p className="text-xs text-gray-500 mt-0.5">Você será desconectado</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setIsLogoutModalOpen(false)} className="flex-1 py-3 bg-white/5 border border-white/10 text-gray-400 text-xs font-bold hover:bg-white/10 hover:text-white transition-all duration-300">
                Cancelar
              </button>
              <button onClick={onLogout} className="flex-1 py-3 bg-red-500/90 text-white text-xs font-bold hover:bg-red-500 transition-all duration-300">
                Sair
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* MODAL: EDIT TEAM */}
      {isEditTeamModalOpen && (
        <ModalBackdrop onClose={() => setIsEditTeamModalOpen(false)}>
          <form onSubmit={handleSaveTeamName} className="bg-[#0B0411]/95 backdrop-blur-xl border border-white/10 w-full max-w-md p-8 space-y-6 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-[#6366F1]/10 flex items-center justify-center border border-[#6366F1]/20">
                <i className="fa-solid fa-shield-halved text-xl text-[#6366F1]"></i>
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Nome da Equipe</h3>
                <p className="text-xs text-gray-500 mt-0.5">Altere a identidade do seu time</p>
              </div>
            </div>
            <div>
              <input
                type="text"
                value={tempTeamName}
                onChange={(e) => { setTempTeamName(e.target.value.toUpperCase()); setTeamNameError(null); }}
                className={`w-full bg-white/5 border py-3.5 px-4 text-sm font-bold text-white placeholder:text-gray-600 focus:outline-none focus:border-[#6366F1]/50 focus:bg-white/[0.07] transition-all ${teamNameError ? 'border-red-500/50' : 'border-white/10'}`}
                placeholder="DIGITE O NOME..."
                autoFocus
              />
              {teamNameError && <p className="text-red-400 text-xs mt-2">{teamNameError}</p>}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setIsEditTeamModalOpen(false)} className="flex-1 py-3 bg-white/5 border border-white/10 text-gray-400 text-xs font-bold hover:bg-white/10 hover:text-white transition-all duration-300">
                Cancelar
              </button>
              <button type="submit" className="flex-1 py-3 bg-[#6366F1]/90 text-white text-xs font-bold hover:bg-[#6366F1] transition-all duration-300">
                Salvar
              </button>
            </div>
          </form>
        </ModalBackdrop>
      )}

      {/* MODAL: LANGUAGE */}
      {isLanguageModalOpen && (
        <ModalBackdrop onClose={() => setIsLanguageModalOpen(false)}>
          <div className="bg-[#0B0411]/95 backdrop-blur-xl border border-white/10 w-full max-w-sm p-8 space-y-6 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <i className="fa-solid fa-language text-xl text-emerald-400"></i>
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Idioma</h3>
                <p className="text-xs text-gray-500 mt-0.5">Selecione sua preferência</p>
              </div>
            </div>
            <div className="space-y-3">
              <button 
                onClick={() => { setCurrentLang('PT'); setIsLanguageModalOpen(false); }} 
                className={`w-full py-3.5 px-4 text-sm font-bold transition-all duration-300 flex items-center gap-3 ${
                  currentLang === 'PT' 
                    ? 'bg-[#6366F1]/90 text-white' 
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                <img src="https://flagcdn.com/w40/br.png" className="w-5 h-auto" alt="BR" /> 
                Português (Brasil)
              </button>
              <button 
                onClick={() => { setCurrentLang('EN'); setIsLanguageModalOpen(false); }} 
                className={`w-full py-3.5 px-4 text-sm font-bold transition-all duration-300 flex items-center gap-3 ${
                  currentLang === 'EN' 
                    ? 'bg-[#6366F1]/90 text-white' 
                    : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'
                }`}
              >
                <img src="https://flagcdn.com/w40/us.png" className="w-5 h-auto" alt="US" /> 
                English (US)
              </button>
            </div>
          </div>
        </ModalBackdrop>
      )}

      {/* MODAL: AVATAR SELECTOR */}
      {isChangingAvatar && (
        <ModalBackdrop onClose={() => setIsChangingAvatar(false)}>
          <div className="bg-[#0B0411]/95 backdrop-blur-xl border border-white/10 w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-white/5 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-[#6366F1]/10 flex items-center justify-center border border-[#6366F1]/20">
                  <i className="fa-solid fa-image text-base text-[#6366F1]"></i>
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Escolher Avatar</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Selecione um campeão</p>
                </div>
              </div>
              <button onClick={() => setIsChangingAvatar(false)} className="w-10 h-10 flex items-center justify-center bg-white/5 border border-white/10 text-gray-500 hover:text-white hover:bg-white/10 transition-all">
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-black/20">
              <div className="space-y-6">
                <div className="relative">
                  <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-sm"></i>
                  <input 
                    type="text" 
                    placeholder="Buscar campeão..." 
                    className="w-full bg-white/5 border border-white/10 py-3 pl-11 pr-4 text-sm font-medium text-white placeholder:text-gray-600 focus:outline-none focus:border-[#6366F1]/50 focus:bg-white/[0.07] transition-all" 
                    value={champSearch} 
                    onChange={(e) => setChampSearch(e.target.value)} 
                    autoFocus 
                  />
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {filteredChampions.map((champ, index) => (
                    <button 
                      key={champ.id} 
                      onClick={() => handleSaveAvatar(champ.url)} 
                      className={`group relative aspect-square overflow-hidden border-2 transition-all duration-300 animate-in fade-in zoom-in-95 fill-mode-both ${
                        formData.avatar === champ.url 
                          ? 'border-[#6366F1]/80 scale-105' 
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
                        <div className="absolute inset-0 bg-[#6366F1]/20 flex items-center justify-center">
                          <i className="fa-solid fa-check text-white text-xl"></i>
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
      <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both">
        
         {/* AVATAR HEADER - MINIMALISTA */}
         <div className="relative py-8 px-4 text-center">
           <div className="relative inline-block group mb-6 animate-in zoom-in-95 duration-500 fill-mode-both" onClick={() => setIsChangingAvatar(true)}>
             <div className="absolute inset-[-20px] bg-[#6366F1]/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
             <div className="relative w-32 h-32 overflow-hidden cursor-pointer border-2 border-white/10 group-hover:border-[#6366F1]/50 transition-all duration-500 shadow-lg">
                <img src={formData.avatar} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="Avatar" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300">
                   <i className="fa-solid fa-camera text-white text-2xl group-hover:scale-110 transition-transform duration-300"></i>
                </div>
             </div>
           </div>
           
           <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 fill-mode-both">
             <h1 className="text-4xl font-orbitron font-black text-white uppercase tracking-tight">{formData.userName}</h1>
             <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">{formData.name}</p>
           </div>
        </div>

        {/* SETTINGS LIST - MINIMALISTA */}
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 fill-mode-both">
          <div className="px-4">
            <h2 className="text-xs font-bold text-gray-600 uppercase tracking-wider">Configurações</h2>
          </div>
          
          <div className="space-y-3">
            <SettingItem 
              icon="fa-shield-halved" 
              label="NOME DA EQUIPE" 
              value={formData.name} 
              onClick={() => {
                setTempTeamName(formData.name);
                setIsEditTeamModalOpen(true);
              }} 
              color="text-[#6366F1]"
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
