
import React, { useState, useRef } from 'react';
import { DataService } from '../services/api';

interface CreateLeagueModalProps {
  onClose: () => void;
  onSuccess: (leagueCode: string, leagueName: string) => void;
  userId: string;
}

const CreateLeagueModal: React.FC<CreateLeagueModalProps> = ({ onClose, onSuccess, userId }) => {
  const [newLeagueName, setNewLeagueName] = useState('');
  const [newLeagueFormat, setNewLeagueFormat] = useState<'continuo' | 'limitado'>('continuo');
  const [leagueImage, setLeagueImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isClosing, setIsClosing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setLeagueImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('loading');
    setErrorMessage('');
    
    try {
      // Determina o ícone padrão baseado no nome
      const icon = leagueImage ? 'fa-shield' : 'fa-trophy';
      
      // Cria a liga no banco de dados
      const result = await DataService.createLeague({
        name: newLeagueName,
        icon: icon,
        isPublic: false, // Por padrão, ligas são privadas
        createdBy: userId
      });

      if (result.ok && result.code) {
        setSubmitStatus('success');
        setTimeout(() => {
          onSuccess(result.code!, newLeagueName);
          triggerClose();
        }, 1000);
      } else {
        setSubmitStatus('error');
        setErrorMessage(result.error || 'Erro ao criar liga');
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error('Erro ao criar liga:', error);
      setSubmitStatus('error');
      setErrorMessage('Erro inesperado ao criar liga');
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[2000] flex items-center justify-center p-4 md:p-8 transition-all duration-300 ${isClosing ? 'bg-black/0' : 'bg-black/95 backdrop-blur-xl animate-in fade-in'}`}>
      <div className="absolute inset-0" onClick={() => !isSubmitting && triggerClose()}></div>
      
      <div className={`relative w-full max-w-xl bg-[#0B0411] border border-white/10 shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col max-h-[90vh] transition-all duration-500 overflow-hidden ${isClosing ? 'opacity-0 scale-95 translate-y-12' : 'opacity-100 scale-100 translate-y-0 animate-in zoom-in-95'}`}>
        
        {/* Cabeçalho */}
        <div className="p-6 border-b border-white/5 bg-gradient-to-r from-[#3b82f6]/10 to-transparent shrink-0 flex items-center justify-between">
          <div>
            <h2 className="font-orbitron font-black text-xl text-white uppercase tracking-tight mb-1">NOVA LIGA</h2>
            <span className="text-[9px] font-black text-[#3b82f6] uppercase tracking-widest">SISTEMA DE FUNDAÇÃO</span>
          </div>
          {!isSubmitting && (
            <button onClick={triggerClose} className="w-9 h-9 flex items-center justify-center bg-white/5 border border-white/10 text-gray-500 hover:text-[#3b82f6] hover:border-[#3b82f6]/40 transition-all">
              <i className="fa-solid fa-xmark text-lg"></i>
            </button>
          )}
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 no-scrollbar bg-black/30">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] px-1 block">NOME DA LIGA *</label>
              <input 
                type="text" 
                placeholder="EX: LIGA DOS POROS" 
                value={newLeagueName} 
                onChange={(e) => setNewLeagueName(e.target.value.toUpperCase())} 
                className="w-full bg-white/5 border border-white/10 py-3 px-5 text-[13px] text-white font-black tracking-tight focus:outline-none focus:border-[#3b82f6]/60 transition-all placeholder:text-gray-800" 
                required 
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-3">
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] px-1 block">IDENTIDADE (BRASÃO)</label>
              <div 
                onClick={() => !isSubmitting && fileInputRef.current?.click()}
                className={`w-full bg-white/5 border-2 border-dashed p-6 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all group ${leagueImage ? 'border-[#3b82f6]/50' : 'border-white/5 hover:border-[#3b82f6]/40'}`}
              >
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
                {leagueImage ? (
                  <div className="w-20 h-20 overflow-hidden border-2 border-black bg-black shadow-lg">
                    <img src={leagueImage} className="w-full h-full object-cover" alt="Preview" />
                  </div>
                ) : (
                  <div className="text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto group-hover:scale-110 group-hover:bg-[#3b82f6]/10 transition-all">
                      <i className="fa-solid fa-upload text-lg text-gray-700 group-hover:text-[#3b82f6]"></i>
                    </div>
                    <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">SUBIR PNG / JPG</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-[0.3em] px-1 block">MECÂNICA DE DISPUTA</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div onClick={() => !isSubmitting && setNewLeagueFormat('continuo')} className={`relative p-4 border-2 transition-all cursor-pointer ${newLeagueFormat === 'continuo' ? 'bg-[#3b82f6]/[0.06] border-[#3b82f6]/60 shadow-[0_0_20px_rgba(59,130,246,0.05)]' : 'bg-white/5 border-transparent hover:border-white/10'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${newLeagueFormat === 'continuo' ? 'border-[#3b82f6]' : 'border-gray-800'}`}>
                      {newLeagueFormat === 'continuo' && <div className="w-2 h-2 bg-[#3b82f6] rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]"></div>}
                    </div>
                    <div>
                      <h4 className={`text-[12px] font-orbitron font-black uppercase mb-1 ${newLeagueFormat === 'continuo' ? 'text-white' : 'text-gray-600'}`}>CONTÍNUO</h4>
                      <p className="text-[9px] font-medium text-gray-500 leading-snug uppercase tracking-tight">Soma todas as pontuações ao longo da Etapa.</p>
                    </div>
                  </div>
                </div>
                <div onClick={() => !isSubmitting && setNewLeagueFormat('limitado')} className={`relative p-4 border-2 transition-all cursor-pointer ${newLeagueFormat === 'limitado' ? 'bg-[#3b82f6]/[0.06] border-[#3b82f6]/60 shadow-[0_0_20px_rgba(59,130,246,0.05)]' : 'bg-white/5 border-transparent hover:border-white/10'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${newLeagueFormat === 'limitado' ? 'border-[#3b82f6]' : 'border-gray-800'}`}>
                      {newLeagueFormat === 'limitado' && <div className="w-2 h-2 bg-[#3b82f6] rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]"></div>}
                    </div>
                    <div>
                      <h4 className={`text-[12px] font-orbitron font-black uppercase mb-1 ${newLeagueFormat === 'limitado' ? 'text-white' : 'text-gray-600'}`}>LIMITADO</h4>
                      <p className="text-[9px] font-medium text-gray-500 leading-snug uppercase tracking-tight">Conta apenas após o ingresso na Liga.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-3 flex flex-col items-center gap-4 pb-4">
              {submitStatus === 'error' && errorMessage && (
                <div className="w-full p-3 bg-red-500/10 border border-red-500/30">
                  <p className="text-xs font-bold text-red-400 text-center uppercase tracking-wide">{errorMessage}</p>
                </div>
              )}
              
              <button 
                type="submit" 
                disabled={isSubmitting || !newLeagueName}
                className={`group relative w-full py-4 font-orbitron font-black text-sm uppercase tracking-[0.3em] transition-all duration-500 ${
                  submitStatus === 'success' ? 'bg-green-600 text-white' : submitStatus === 'error' ? 'bg-red-600 text-white' : isSubmitting ? 'bg-gray-800 text-gray-600' : 'bg-[#3b82f6] text-black shadow-[0_20px_50px_rgba(59,130,246,0.4)] hover:scale-[1.01] active:scale-95'
                }`}
              >
                {submitStatus === 'loading' ? 'PROCESSANDO...' : submitStatus === 'success' ? 'LIGA FUNDADA!' : submitStatus === 'error' ? 'ERRO - TENTE NOVAMENTE' : 'CONFIRMAR FUNDAÇÃO'}
              </button>
              <button type="button" onClick={triggerClose} className="text-[9px] font-black text-gray-700 uppercase tracking-[0.3em] hover:text-white transition-all underline underline-offset-4 decoration-[#3b82f6]/20">ABORTAR OPERAÇÃO</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateLeagueModal;
