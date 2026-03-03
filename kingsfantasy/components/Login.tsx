
import React, { useState, useEffect } from 'react';
import { AuthService } from '../services/auth';
import { DataService } from '../services/api';
import backgroundImage from '../assets/images/backgrounds/skt-back.jpg';
import logo from '../assets/images/logo/logo.png';

interface LoginProps {
  onLoginSuccess: (userData: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem('remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSignUp && password !== confirmPassword) {
      setErrorMsg("AS SENHAS NÃO COINCIDEM");
      return;
    }

    if (isSignUp && password.length < 6) {
      setErrorMsg("A SENHA DEVE TER NO MÍNIMO 6 CARACTERES");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    if (rememberMe) {
      localStorage.setItem('remembered_email', email);
    } else {
      localStorage.removeItem('remembered_email');
    }

    let result;
    try {
      if (isSignUp) {
        console.log('🔍 Iniciando cadastro para:', email);
        result = await AuthService.signUp(email, password);
      } else {
        console.log('🔍 Iniciando login para:', email);
        result = await AuthService.signIn(email, password);
      }

      console.log('🔍 Resultado da autenticação:', result.error ? 'ERRO' : 'SUCESSO');

      if (result.requiresEmailConfirmation) {
        setPendingEmail(email);
        setLoading(false);
      } else if (result.error) {
        setErrorMsg(result.error.toUpperCase());
        setLoading(false);
      } else if (result.data) {
        const userPayload = {
          email: result.data.user?.email || email,
          avatar: result.data.user?.user_metadata?.avatar_url
        };
        console.log('✅ Chamando onLoginSuccess com:', userPayload);
        onLoginSuccess(userPayload);
        setLoading(false);
      } else {
        setErrorMsg('RESPOSTA INESPERADA DO SERVIDOR');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('❌ Exception em handleSubmit:', error);
      setErrorMsg((error.message || 'ERRO DESCONHECIDO').toUpperCase());
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: 'google' | 'discord') => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await AuthService.signInWithSocial(provider);
    } catch (err: any) {
      console.error(`❌ Erro ao conectar com ${provider}:`, err);
      setErrorMsg(`ERRO AO CONECTAR COM ${provider.toUpperCase()}`);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[5000] overflow-hidden">
      
      {/* Loading Overlay */}
      {loading && (
        <div className="absolute inset-0 z-[6000] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-6">
            <div className="relative">
              <img 
                src="https://raw.githubusercontent.com/joaomdp/kingsfantasy/main/times/logo.png" 
                alt="Kings Logo" 
                className="w-24 h-24 object-cover animate-pulse shadow-[0_0_60px_rgba(99,102,241,0.6)] invert-[0.1] sepia-[1] saturate-[5] hue-rotate-[210deg]" 
              />
              <div className="absolute inset-0 bg-gradient-to-br from-[#6366F1]/20 to-[#8B5CF6]/20 animate-spin" style={{ animationDuration: '3s' }}></div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#6366F1] animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-[#6366F1] animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-[#6366F1] animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
              <p className="text-sm font-bold text-white uppercase tracking-widest">Carregando...</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Full Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${backgroundImage})`,
        }}
      >
        {/* Gradient Overlay para escurecer e destacar o formulário */}
        <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/50 to-transparent"></div>
      </div>

      <div className="relative w-full max-w-[1600px] h-full flex items-center justify-center mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Form Container - Centralizado */}
        <div className="relative w-full max-w-[550px] z-20">
          <div className="glass-card rounded-3xl md:rounded-[40px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] border border-white/10 animate-in fade-in zoom-in-95 duration-700">
            
            <div className="flex flex-col p-6 sm:p-8 md:p-10 lg:p-12 overflow-y-auto no-scrollbar relative bg-[#0F0F14]/50 backdrop-blur-2xl">
              
              {/* Toggle Button */}
              <div className="absolute top-6 right-6">
                <button 
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setErrorMsg(null);
                    setPassword('');
                    setConfirmPassword('');
                  }}
                  className="px-4 py-2.5 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-white transition-colors border border-white/10 rounded-lg hover:border-[#6366F1]/30 hover:bg-white/5"
                >
                  {isSignUp ? 'JÁ TENHO CONTA' : 'CRIAR CONTA'}
                </button>
              </div>

              <div className="flex-1 flex flex-col justify-center max-w-[420px] mx-auto w-full pt-12">
                
                {/* Logo */}
                <div className="mb-6 md:mb-8 animate-in fade-in slide-in-from-right duration-700 text-center">
                  <div className="inline-flex items-center gap-2.5 mb-4 md:mb-5">
                    <img src={logo} alt="Logo" className="w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl object-cover" />
                    <div className="font-orbitron font-black text-lg md:text-xl text-white uppercase tracking-tight">
                      KINGS <span className="text-[#6366F1]">LENDAS</span> FANTASY
                    </div>
                  </div>
                  <h1 className="font-orbitron font-black text-3xl sm:text-4xl md:text-5xl text-white uppercase tracking-tighter mb-2 md:mb-3">
                    {isSignUp ? 'CRIAR CONTA' : 'BEM-VINDO'}
                  </h1>
                  <p className="text-xs sm:text-sm text-gray-500 font-medium">
                    {isSignUp ? 'Junte-se ao maior campeonato do Brasil' : 'Entre para continuar sua jornada'}
                  </p>
                </div>

                {/* Social Buttons */}
                <div className="grid grid-cols-2 gap-3 mb-6 md:mb-7 animate-in fade-in slide-in-from-right duration-700 delay-100">
                  <button 
                    type="button"
                    onClick={() => handleSocialLogin('discord')}
                    disabled={loading}
                    className="group flex items-center justify-center gap-2 md:gap-2.5 py-3.5 md:py-4 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl hover:bg-[#5865F2]/10 hover:border-[#5865F2]/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fa-brands fa-discord text-[#5865F2] text-lg md:text-xl group-hover:scale-110 transition-transform"></i>
                    <span className="text-xs font-black text-white uppercase tracking-wider">Discord</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleSocialLogin('google')}
                    disabled={loading}
                    className="group flex items-center justify-center gap-2 md:gap-2.5 py-3.5 md:py-4 bg-white/5 border border-white/10 rounded-xl md:rounded-2xl hover:bg-red-500/10 hover:border-red-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <i className="fa-brands fa-google text-red-500 text-lg md:text-xl group-hover:scale-110 transition-transform"></i>
                    <span className="text-xs font-black text-white uppercase tracking-wider">Google</span>
                  </button>
                </div>

                {/* Divider */}
                <div className="relative flex items-center gap-3 mb-6 md:mb-7 animate-in fade-in duration-700 delay-200">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-white/10"></div>
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-widest">ou e-mail</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent via-white/10 to-white/10"></div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5 animate-in fade-in slide-in-from-right duration-700 delay-300">
                  
                  {/* Email */}
                  <div className="space-y-1.5 md:space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">E-mail</label>
                    <input 
                      type="email" 
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 md:py-4 px-4 md:px-5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#6366F1]/50 focus:bg-white/[0.07] transition-all"
                      required
                      disabled={loading}
                    />
                  </div>

                  {/* Username (SignUp only) */}
                  
                  {/* Password */}
                  <div className="space-y-1.5 md:space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Senha</label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 md:py-4 pl-4 md:pl-5 pr-12 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#6366F1]/50 focus:bg-white/[0.07] transition-all"
                        required
                        disabled={loading}
                      />
                      <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-[#6366F1] transition-colors"
                        disabled={loading}
                      >
                        <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password (SignUp only) */}
                  {isSignUp && (
                    <div className="space-y-1.5 md:space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Confirmar Senha</label>
                      <div className="relative">
                        <input 
                          type={showPassword ? "text" : "password"} 
                          placeholder="••••••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={`w-full bg-white/5 border rounded-xl py-3.5 md:py-4 pl-4 md:pl-5 pr-12 text-sm text-white placeholder-gray-600 focus:outline-none transition-all ${
                            confirmPassword && password !== confirmPassword 
                              ? 'border-red-500/50 focus:border-red-500' 
                              : 'border-white/10 focus:border-[#6366F1]/50 focus:bg-white/[0.07]'
                          }`}
                          required={isSignUp}
                          disabled={loading}
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-[#6366F1] transition-colors"
                          disabled={loading}
                        >
                          <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-sm`}></i>
                        </button>
                      </div>
                      {confirmPassword && password !== confirmPassword && (
                        <p className="text-xs font-bold text-red-500 uppercase tracking-wider">Senhas não coincidem</p>
                      )}
                    </div>
                  )}

                  {/* Remember Me */}
                  {!isSignUp && (
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        checked={rememberMe} 
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="sr-only" 
                        disabled={loading}
                      />
                      <div className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center ${
                        rememberMe ? 'bg-[#6366F1] border-[#6366F1]' : 'bg-white/5 border-white/10 group-hover:border-white/20'
                      }`}>
                        {rememberMe && (
                          <i className="fa-solid fa-check text-white text-xs"></i>
                        )}
                      </div>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider group-hover:text-gray-300 transition-colors">
                        Lembrar de mim
                      </span>
                    </label>
                  )}
                  
                {/* Error Message */}
                {errorMsg && (
                  <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
                      <i className="fa-solid fa-circle-exclamation text-red-500 text-lg mt-0.5"></i>
                      <p className="text-xs font-bold text-red-400 uppercase tracking-wider leading-relaxed">
                        {errorMsg}
                      </p>
                    </div>
                  </div>
                )}

                  {/* Submit Button */}
                  <button 
                    type="submit" 
                    disabled={loading || (isSignUp && confirmPassword !== '' && password !== confirmPassword)}
                    className="w-full py-4 md:py-5 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] text-white rounded-xl font-orbitron font-black text-sm uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-[0_12px_35px_rgba(99,102,241,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 mt-5 md:mt-6 relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <span className="relative z-10">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2">
                          <i className="fa-solid fa-spinner fa-spin"></i>
                          CARREGANDO...
                        </div>
                      ) : isSignUp ? 'CRIAR CONTA' : 'ENTRAR'}
                    </span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      {pendingEmail && (
        <div className="absolute inset-0 z-[7000] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="glass-card border border-white/10 rounded-3xl p-8 max-w-md w-full mx-6 shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-orbitron font-black text-white uppercase tracking-tight">Confirme seu email</h3>
              <button
                type="button"
                onClick={() => setPendingEmail(null)}
                className="w-9 h-9 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:border-[#6366F1]/40 transition-colors"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Enviamos um link de confirmacao para <span className="text-white font-bold">{pendingEmail}</span>.
              Confirme o email para concluir seu cadastro.
            </p>
            <div className="mt-6 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPendingEmail(null)}
                className="btn-secondary text-xs uppercase tracking-wider"
              >
                Entendi
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingEmail(null);
                  setIsSignUp(false);
                }}
                className="btn-primary text-xs uppercase tracking-wider"
              >
                Voltar para login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
