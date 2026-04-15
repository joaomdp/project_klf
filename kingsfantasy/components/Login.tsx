
import React, { useState, useEffect } from 'react';
import { AuthService } from '../services/auth';
import { DataService } from '../services/api';
import backgroundImage from '../assets/images/backgrounds/skt-back.jpg';
import logo from '../assets/images/logo/logo.png';
import LoadingScreen from './LoadingScreen';
import { useToast } from './Toast';

interface LoginProps {
  onLoginSuccess: (userData: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const { showToast } = useToast();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [forgotPasswordMsg, setForgotPasswordMsg] = useState<string | null>(null);
  const [isSendingForgotPassword, setIsSendingForgotPassword] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetPasswordMsg, setResetPasswordMsg] = useState<string | null>(null);
  const [isSubmittingResetPassword, setIsSubmittingResetPassword] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem('remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
    }

    if (AuthService.isRecoveryPending()) {
      setIsResetPasswordOpen(true);
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
        result = await AuthService.signUp(email, password);
      } else {
        result = await AuthService.signIn(email, password);
      }

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordMsg(null);

    const targetEmail = forgotPasswordEmail.trim() || email.trim();
    if (!targetEmail) {
      setForgotPasswordMsg('INFORME UM E-MAIL VÁLIDO');
      showToast({ type: 'warning', title: 'E-mail inválido', message: 'Informe um e-mail para recuperar a senha.' });
      return;
    }

    setIsSendingForgotPassword(true);
    try {
      const result = await AuthService.requestPasswordReset(targetEmail);

      if (!result.ok) {
        setForgotPasswordMsg((result.error || 'ERRO AO ENVIAR RECUPERAÇÃO').toUpperCase());
        showToast({ type: 'error', title: 'Falha ao enviar link', message: result.error || 'Erro ao enviar recuperação.' });
        return;
      }

      setForgotPasswordMsg('LINK DE RECUPERAÇÃO ENVIADO. VERIFIQUE SEU E-MAIL.');
      showToast({ type: 'success', title: 'Link enviado', message: `Verifique o e-mail ${targetEmail}.`, duration: 4000 });
    } catch (error) {
      console.error('Erro ao solicitar recuperação de senha:', error);
      setForgotPasswordMsg('ERRO INESPERADO. TENTE NOVAMENTE.');
      showToast({ type: 'error', title: 'Erro inesperado', message: 'Não foi possível enviar o link de recuperação.' });
    } finally {
      setIsSendingForgotPassword(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetPasswordMsg(null);

    if (newPassword.length < 6) {
      setResetPasswordMsg('A SENHA DEVE TER NO MÍNIMO 6 CARACTERES');
      showToast({ type: 'warning', title: 'Senha fraca', message: 'A senha deve ter no mínimo 6 caracteres.' });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setResetPasswordMsg('AS SENHAS NÃO COINCIDEM');
      showToast({ type: 'warning', title: 'Senhas diferentes', message: 'As senhas informadas não coincidem.' });
      return;
    }

    setIsSubmittingResetPassword(true);
    try {
      const recoveryToken = AuthService.getRecoveryToken();
      const result = await AuthService.updatePassword(newPassword, recoveryToken);

      if (!result.ok) {
        setResetPasswordMsg((result.error || 'ERRO AO ATUALIZAR SENHA').toUpperCase());
        showToast({ type: 'error', title: 'Falha ao atualizar senha', message: result.error || 'Erro ao atualizar senha.' });
        return;
      }

      AuthService.clearRecoveryState();
      setResetPasswordMsg('SENHA ATUALIZADA COM SUCESSO. FAÇA LOGIN.');
      showToast({ type: 'success', title: 'Senha atualizada', message: 'Faça login com sua nova senha.', duration: 4000 });
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      console.error('Erro ao redefinir senha:', error);
      setResetPasswordMsg('ERRO INESPERADO. TENTE NOVAMENTE.');
      showToast({ type: 'error', title: 'Erro inesperado', message: 'Não foi possível redefinir a senha.' });
    } finally {
      setIsSubmittingResetPassword(false);
    }

    setTimeout(() => {
      setIsResetPasswordOpen(false);
      setResetPasswordMsg(null);
    }, 1400);
  };

  return (
    <div className="fixed inset-0 z-[5000] overflow-y-auto overflow-x-hidden min-h-[100dvh]">
      
      {/* Loading Overlay */}
      {loading && <LoadingScreen />}
      
      {/* ── LAYOUT SPLIT ── */}
      <div className="relative flex min-h-[100dvh] w-full animate-in fade-in duration-700">

        {/* ── PAINEL ESQUERDO — branding (só desktop) ── */}
        <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] relative overflow-hidden">
          {/* Background */}
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${backgroundImage})` }} />
          <div className="absolute inset-0 bg-gradient-to-r from-black/20 via-black/40 to-black/80" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

          {/* Conteúdo branding */}
          <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
            {/* Logo topo */}
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className="w-10 h-10 rounded-xl object-cover shadow-lg" />
              <span className="font-orbitron font-black text-lg text-white uppercase tracking-tight">
                KINGS <span className="text-[#3b82f6]">LENDAS</span> FANTASY
              </span>
            </div>

            {/* Título central */}
            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-black text-[#3b82f6] uppercase tracking-[0.4em] mb-3">TEMPORADA 2026</p>
                <h2 className="font-orbitron font-black text-5xl xl:text-6xl text-white uppercase tracking-tighter leading-[0.9] mb-4">
                  MONTE SEU<br /><span className="text-[#3b82f6]">TIME</span><br />PERFEITO
                </h2>
                <p className="text-sm text-gray-400 leading-relaxed max-w-sm">
                  Escale os melhores jogadores do Kings Lendas, acumule pontos e domine o ranking da sua liga.
                </p>
              </div>

              {/* Features */}
              <div className="space-y-3">
                {[
                  { icon: 'fa-trophy', text: 'Compete em ligas com seus amigos' },
                  { icon: 'fa-chart-line', text: 'Acompanhe pontuações em tempo real' },
                  { icon: 'fa-robot', text: 'Receba dicas do AI Coach' },
                ].map((f) => (
                  <div key={f.icon} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/15 border border-[#3b82f6]/25 flex items-center justify-center shrink-0">
                      <i className={`fa-solid ${f.icon} text-[#3b82f6] text-xs`}></i>
                    </div>
                    <span className="text-sm text-gray-300 font-medium">{f.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Rodapé */}
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-black">© 2026 KINGS LENDAS FANTASY</p>
          </div>
        </div>

        {/* ── PAINEL DIREITO — formulário ── */}
        <div className="flex-1 flex flex-col relative bg-[#08090e] lg:border-l lg:border-white/8">

          {/* Background mobile (só aparece em telas pequenas) */}
          <div className="absolute inset-0 lg:hidden bg-cover bg-center bg-no-repeat opacity-20" style={{ backgroundImage: `url(${backgroundImage})` }} />
          <div className="absolute inset-0 lg:hidden bg-gradient-to-b from-[#08090e]/60 via-[#08090e]/80 to-[#08090e]" />

          {/* Conteúdo do form */}
          <div className="relative z-10 flex flex-col flex-1 items-center justify-center px-5 xs:px-6 sm:px-10 md:px-16 lg:px-12 xl:px-16 py-10">


            <div className="w-full max-w-[400px] space-y-6 sm:space-y-7">

              {/* Logo (mobile only) */}
              <div className="flex lg:hidden items-center gap-2.5 mb-2">
                <img src={logo} alt="Logo" className="w-9 h-9 rounded-xl object-cover" />
                <span className="font-orbitron font-black text-base text-white uppercase tracking-tight">
                  KINGS <span className="text-[#3b82f6]">LENDAS</span> FANTASY
                </span>
              </div>

              {/* Título */}
              <div>
                <h1 className="font-orbitron font-black text-3xl sm:text-4xl text-white uppercase tracking-tighter leading-tight mb-1.5">
                  {isSignUp ? 'CRIAR CONTA' : 'BEM-VINDO'}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500">
                  {isSignUp ? 'Junte-se ao maior campeonato do Brasil' : 'Entre para continuar sua jornada'}
                </p>
              </div>

              {/* Social */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSocialLogin('discord')}
                  disabled={loading}
                  className="group flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/8 rounded-xl hover:bg-[#5865F2]/10 hover:border-[#5865F2]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fa-brands fa-discord text-gray-500 group-hover:text-[#5865F2] text-base transition-colors"></i>
                  <span className="text-[11px] font-black text-gray-500 group-hover:text-white uppercase tracking-wider transition-colors">Discord</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSocialLogin('google')}
                  disabled={loading}
                  className="group flex items-center justify-center gap-2 py-3 bg-white/5 border border-white/8 rounded-xl hover:bg-white/10 hover:border-white/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <i className="fa-brands fa-google text-gray-500 group-hover:text-white text-base transition-colors"></i>
                  <span className="text-[11px] font-black text-gray-500 group-hover:text-white uppercase tracking-wider transition-colors">Google</span>
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/8"></div>
                <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">ou e-mail</span>
                <div className="h-px flex-1 bg-white/8"></div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">

                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">E-mail</label>
                  <div className="relative">
                    <i className="fa-solid fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-xs pointer-events-none"></i>
                    <input
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl py-3.5 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.07] transition-all"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Senha */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Senha</label>
                  <div className="relative">
                    <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-xs pointer-events-none"></i>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white/[0.04] border border-white/8 rounded-xl py-3.5 pl-10 pr-11 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#3b82f6]/50 focus:bg-white/[0.07] transition-all"
                      required
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-[#3b82f6] transition-colors"
                      disabled={loading}
                    >
                      <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                    </button>
                  </div>
                </div>

                {/* Confirmar senha (cadastro) */}
                {isSignUp && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Confirmar Senha</label>
                    <div className="relative">
                      <i className="fa-solid fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 text-xs pointer-events-none"></i>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className={`w-full bg-white/[0.04] border rounded-xl py-3.5 pl-10 pr-11 text-sm text-white placeholder-gray-600 focus:outline-none transition-all ${
                          confirmPassword && password !== confirmPassword
                            ? 'border-red-500/50 focus:border-red-500'
                            : 'border-white/8 focus:border-[#3b82f6]/50 focus:bg-white/[0.07]'
                        }`}
                        required={isSignUp}
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-[#3b82f6] transition-colors"
                        disabled={loading}
                      >
                        <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                      </button>
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-[10px] font-black text-red-400 uppercase tracking-wider">Senhas não coincidem</p>
                    )}
                  </div>
                )}

                {/* Lembrar / Esqueci */}
                {!isSignUp && (
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="sr-only"
                        disabled={loading}
                      />
                      <div className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${rememberMe ? 'bg-[#3b82f6] border-[#3b82f6]' : 'bg-white/5 border-white/15 group-hover:border-white/30'}`}>
                        {rememberMe && <i className="fa-solid fa-check text-white text-[9px]"></i>}
                      </div>
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider group-hover:text-gray-300 transition-colors">Lembrar</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => { setForgotPasswordEmail(email); setForgotPasswordMsg(null); setIsForgotPasswordOpen(true); }}
                      className="text-[10px] font-black text-[#3b82f6] hover:text-white uppercase tracking-widest transition-colors"
                      disabled={loading}
                    >
                      Esqueci a senha
                    </button>
                  </div>
                )}

                {/* Erro */}
                {errorMsg && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-red-500/8 border border-red-500/25 rounded-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <i className="fa-solid fa-circle-exclamation text-red-400 text-sm mt-0.5 shrink-0"></i>
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-wider leading-relaxed">{errorMsg}</p>
                  </div>
                )}

                {/* Botão submit */}
                <button
                  type="submit"
                  disabled={loading || (isSignUp && confirmPassword !== '' && password !== confirmPassword)}
                  className="w-full py-4 bg-gradient-to-r from-[#3b82f6] to-[#6366f1] text-white rounded-xl font-orbitron font-black text-xs uppercase tracking-widest transition-all shadow-[0_8px_25px_rgba(59,130,246,0.3)] hover:shadow-[0_12px_35px_rgba(59,130,246,0.45)] hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100 relative overflow-hidden group mt-2"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {loading
                      ? <><i className="fa-solid fa-spinner fa-spin"></i> CARREGANDO...</>
                      : isSignUp ? 'CRIAR CONTA' : 'ENTRAR'
                    }
                  </span>
                </button>
              </form>

              {/* Toggle mobile (abaixo do form) */}
              <p className="text-center text-[11px] text-gray-600">
                {isSignUp ? 'Já tem uma conta?' : 'Ainda não tem conta?'}{' '}
                <button
                  onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(null); }}
                  disabled={loading}
                  className="font-black text-[#3b82f6] hover:text-white transition-colors uppercase tracking-wider"
                >
                  {isSignUp ? 'Entrar' : 'Criar conta'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>

      {pendingEmail && (
        <div className="absolute inset-0 z-[7000] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300 px-5">
          <div className="bg-[#0d0e14] border border-white/8 rounded-2xl p-8 max-w-sm w-full flex flex-col items-center gap-6 text-center shadow-[0_32px_80px_rgba(0,0,0,0.7)]">
            <div className="w-12 h-12 bg-[#3b82f6] rounded-full flex items-center justify-center shadow-[0_0_24px_rgba(59,130,246,0.4)]">
              <i className="fa-solid fa-envelope text-white text-base"></i>
            </div>
            <div>
              <h3 className="font-orbitron font-black text-white text-lg uppercase tracking-tight mb-2">Confirme seu email</h3>
              <p className="text-gray-500 text-xs leading-relaxed">
                Enviamos um link para <span className="text-gray-300 break-all">{pendingEmail}</span>. Verifique sua caixa de entrada.
              </p>
            </div>
            <div className="w-full flex flex-col gap-2">
              <button
                type="button"
                onClick={() => { setPendingEmail(null); setIsSignUp(false); }}
                className="w-full py-3 bg-[#3b82f6] text-white font-black text-xs uppercase tracking-widest rounded-xl hover:brightness-110 active:scale-[0.98] transition-all"
              >
                Ir para login
              </button>
              <button
                type="button"
                onClick={() => setPendingEmail(null)}
                className="w-full py-3 bg-white/5 border border-white/8 text-gray-400 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-white/8 transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {isForgotPasswordOpen && (
        <div className="absolute inset-0 z-[7000] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300 px-5">
          <div className="bg-[#0d0e14] border border-white/8 rounded-2xl p-8 max-w-sm w-full shadow-[0_32px_80px_rgba(0,0,0,0.7)]">

            {/* Header */}
            <div className="flex flex-col items-center gap-4 mb-7">
              <div className="w-11 h-11 bg-[#3b82f6]/10 border border-[#3b82f6]/20 rounded-full flex items-center justify-center">
                <i className="fa-solid fa-lock text-[#3b82f6] text-sm"></i>
              </div>
              <div className="text-center">
                <h3 className="font-orbitron font-black text-white text-base uppercase tracking-tight">Recuperar senha</h3>
                <p className="text-gray-500 text-[11px] mt-1">Informe o e-mail da sua conta</p>
              </div>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-4">
              <input
                type="email"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-white/[0.04] border border-white/8 rounded-xl py-3.5 px-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#3b82f6]/50 transition-all"
                required
                disabled={isSendingForgotPassword}
              />

              {forgotPasswordMsg && (
                <p className={`text-[11px] text-center font-medium ${forgotPasswordMsg.includes('ENVIADO') ? 'text-green-400' : 'text-red-400'}`}>
                  {forgotPasswordMsg}
                </p>
              )}

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#3b82f6] text-white font-black text-xs uppercase tracking-widest rounded-xl hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40"
                  disabled={isSendingForgotPassword}
                >
                  {isSendingForgotPassword ? 'Enviando...' : 'Enviar link'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(false)}
                  className="w-full py-3 bg-white/5 border border-white/8 text-gray-500 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-white/8 transition-all"
                  disabled={isSendingForgotPassword}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isResetPasswordOpen && (
        <div className="absolute inset-0 z-[7000] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-300 px-5">
          <div className="bg-[#0d0e14] border border-white/8 rounded-2xl p-8 max-w-sm w-full shadow-[0_32px_80px_rgba(0,0,0,0.7)]">

            {/* Header */}
            <div className="flex flex-col items-center gap-4 mb-7">
              <div className="w-11 h-11 bg-[#3b82f6]/10 border border-[#3b82f6]/20 rounded-full flex items-center justify-center">
                <i className="fa-solid fa-key text-[#3b82f6] text-sm"></i>
              </div>
              <div className="text-center">
                <h3 className="font-orbitron font-black text-white text-base uppercase tracking-tight">Nova senha</h3>
                <p className="text-gray-500 text-[11px] mt-1">Escolha uma senha segura</p>
              </div>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-3">
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha"
                  className="w-full bg-white/[0.04] border border-white/8 rounded-xl py-3.5 pl-4 pr-11 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#3b82f6]/50 transition-all"
                  required
                  disabled={isSubmittingResetPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-[#3b82f6] transition-colors"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Confirmar senha"
                  className={`w-full bg-white/[0.04] border rounded-xl py-3.5 pl-4 pr-11 text-sm text-white placeholder-gray-600 focus:outline-none transition-all ${
                    confirmNewPassword && newPassword !== confirmNewPassword
                      ? 'border-red-500/40 focus:border-red-500/60'
                      : 'border-white/8 focus:border-[#3b82f6]/50'
                  }`}
                  required
                  disabled={isSubmittingResetPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-[#3b82f6] transition-colors"
                >
                  <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                </button>
              </div>

              {resetPasswordMsg && (
                <p className={`text-[11px] text-center font-medium ${resetPasswordMsg.includes('SUCESSO') ? 'text-green-400' : 'text-red-400'}`}>
                  {resetPasswordMsg}
                </p>
              )}

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#3b82f6] text-white font-black text-xs uppercase tracking-widest rounded-xl hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-40"
                  disabled={isSubmittingResetPassword}
                >
                  {isSubmittingResetPassword ? 'Salvando...' : 'Atualizar senha'}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsResetPasswordOpen(false); setResetPasswordMsg(null); AuthService.clearRecoveryState(); }}
                  className="w-full py-3 bg-white/5 border border-white/8 text-gray-500 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-white/8 transition-all"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
