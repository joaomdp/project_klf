import { DataService } from './api';

/**
 * Helper function to decode JWT token and extract user data
 * @param token - JWT token string
 * @returns Decoded token payload or null if invalid
 */
function decodeJWT(token: string) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('❌ Error decoding JWT:', error);
    return null;
  }
}

/**
 * Authentication Service
 * Handles user authentication with Supabase Auth API
 */
export const AuthService = {
  /**
   * Creates a new user account
   * @param email - User email
   * @param pass - User password
   * @param userName - Display username
   * @returns Promise with session data or error
   */
  async signUp(email: string, pass: string, userName?: string) {
    const anonKey = DataService.getAnonKey();
    try {
      const trimmedUserName = userName?.trim();
      const res = await fetch(`${DataService.SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: { 
          'apikey': anonKey, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ 
          email, 
          password: pass,
          ...(trimmedUserName
            ? {
              options: {
                data: {
                  user_name: trimmedUserName
                }
              }
            }
            : {})
        })
      });
      
      const data = await res.json();
      
      console.log('🔍 DEBUG SignUp - Status:', res.status);
      console.log('🔍 DEBUG SignUp - Response:', JSON.stringify(data, null, 2));
      
      if (!res.ok) {
        console.error('❌ SignUp Error:', data);
        const rawMsg = data.msg || data.error_description || data.error || 'Erro ao criar conta.';
        const msg = String(rawMsg).toLowerCase();
        if (msg.includes('already registered') || msg.includes('already been registered') || (msg.includes('email') && msg.includes('exists'))) {
          throw new Error('E-mail já cadastrado.');
        }
        throw new Error(rawMsg);
      }
      
      // Case 1: Supabase returns access_token directly (email confirmation disabled)
      if (data.access_token) {
        const decodedToken = decodeJWT(data.access_token);
        
        const session = {
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          user: {
            id: decodedToken?.sub || data.user?.id || null,
            email: decodedToken?.email || data.user?.email || email,
            user_metadata: {
              ...(trimmedUserName ? { user_name: trimmedUserName } : {}),
              ...data.user?.user_metadata
            }
          }
        };
        
        console.log('✅ Sessão criada com token:', session.user.id);
        localStorage.setItem('nexus_session', JSON.stringify(session));
        return { data: session, error: null };
      }
      
      // Case 2: User created but needs email confirmation
      if (data.id || data.user?.id) {
        const confirmationSentAt = data.confirmation_sent_at || data.user?.confirmation_sent_at;
        const emailConfirmedAt = data.email_confirmed_at || data.user?.email_confirmed_at;

        if (confirmationSentAt || !emailConfirmedAt) {
          console.log('📧 Confirmação de email necessária');
          return { data: null, error: null, requiresEmailConfirmation: true };
        }
      }
      
      throw new Error('Resposta inesperada do servidor.');
    } catch (e: any) {
      console.error('❌ Exception em signUp:', e);
      return { data: null, error: e.message };
    }
  },

  /**
   * Authenticates existing user with email/password
   * @param email - User email
   * @param pass - User password
   * @returns Promise with session data or error
   */
  async signIn(email: string, pass: string) {
    const anonKey = DataService.getAnonKey();
    try {
      const res = await fetch(`${DataService.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { 
          'apikey': anonKey, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ email, password: pass })
      });
      
      const data = await res.json();
      
      console.log('🔍 DEBUG SignIn - Status:', res.status);
      console.log('🔍 DEBUG SignIn - Response:', JSON.stringify(data, null, 2));
      
      if (!res.ok) {
        const errorMsg = data.error_description || data.error || 'E-mail ou senha inválidos.';
        console.error('❌ SignIn Error:', errorMsg);
        
        // Check if it's email confirmation error
        if (errorMsg.toLowerCase().includes('email') && errorMsg.toLowerCase().includes('confirm')) {
          throw new Error('Email não confirmado. Verifique sua caixa de entrada.');
        }
        
        throw new Error(errorMsg);
      }

      if (!data.access_token) {
        throw new Error('Token de acesso não recebido.');
      }

      // Decode JWT to extract user data
      const decodedToken = decodeJWT(data.access_token);
      
      // Build session object
      const session = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: {
          id: decodedToken?.sub || data.user?.id || null,
          email: decodedToken?.email || data.user?.email || email,
          user_metadata: data.user?.user_metadata || {}
        }
      };
      
      console.log('✅ Login bem-sucedido, userId:', session.user.id);
      localStorage.setItem('nexus_session', JSON.stringify(session));
      return { data: session, error: null };
    } catch (e: any) {
      console.error('❌ Exception em signIn:', e);
      return { data: null, error: e.message };
    }
  },

  /**
   * Initiates OAuth flow with social provider
   * @param provider - 'google' or 'discord'
   */
  async signInWithSocial(provider: 'google' | 'discord') {
    const anonKey = DataService.getAnonKey();
    const redirectTo = window.location.origin.replace(/\/$/, "");
    
    const params = new URLSearchParams({
      provider: provider,
      redirect_to: redirectTo,
    });

    const authUrl = `${DataService.SUPABASE_URL}/auth/v1/authorize?${params.toString()}&apikey=${anonKey}`;
    window.location.href = authUrl;
  },

  /**
   * Handles OAuth callback from social providers
   * Extracts token from URL hash and creates session
   * @returns Session object or null
   */
  handleAuthCallback() {
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(window.location.search);
    
    const error = urlParams.get('error_description') || urlParams.get('error');
    if (error) {
      return { error };
    }

    if (!hash || !hash.includes('access_token')) return null;

    try {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      
      if (!accessToken) return null;

      const decodedToken = decodeJWT(accessToken);
      
      const session = {
        access_token: accessToken,
        refresh_token: params.get('refresh_token'),
        user: {
          id: decodedToken?.sub || params.get('sub'),
          email: decodedToken?.email || params.get('email'),
          user_metadata: {
            full_name: params.get('full_name'),
            avatar_url: params.get('avatar_url'),
            user_name: params.get('user_name') || params.get('full_name') || 'INVOCADOR'
          }
        }
      };

      localStorage.setItem('nexus_session', JSON.stringify(session));
      window.history.replaceState(null, '', window.location.origin);
      return session;
    } catch (e) {
      console.error("❌ Erro ao processar tokens:", e);
    }
    return null;
  },

  /**
   * Signs out current user and clears session
   */
  signOut() {
    localStorage.removeItem('nexus_session');
    window.location.reload();
  },

  /**
   * Retrieves current session from localStorage
   * @returns Session object or null if not found/invalid
   */
  getSession() {
    const sessionStr = localStorage.getItem('nexus_session');
    if (!sessionStr) return null;
    try {
      return JSON.parse(sessionStr);
    } catch (e) {
      return null;
    }
  }
};
