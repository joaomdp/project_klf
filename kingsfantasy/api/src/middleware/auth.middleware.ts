import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

/**
 * Interface para adicionar dados do usuário ao Request
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

/**
 * Middleware de Autenticação JWT
 * 
 * Verifica se o token JWT fornecido é válido através do Supabase Auth
 * Extrai user_id e email do token e adiciona ao req.user
 * 
 * Header esperado: Authorization: Bearer <token>
 */
export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Extrair token do header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Token de autenticação não fornecido',
        message: 'Header Authorization: Bearer <token> é obrigatório'
      });
    }

    const token = authHeader.substring(7); // Remove "Bearer "

    // Verificar token com Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('❌ Auth error:', error?.message);
      return res.status(401).json({
        success: false,
        error: 'Token inválido ou expirado',
        message: error?.message || 'Não foi possível autenticar o usuário'
      });
    }

    // Adicionar dados do usuário ao request
    req.user = {
      id: user.id,
      email: user.email || '',
      role: user.user_metadata?.role || 'user'
    };

    next();

  } catch (error) {
    console.error('❌ Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao processar autenticação',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}

/**
 * Middleware de Verificação Admin
 * 
 * Verifica se o email do usuário autenticado está na whitelist de admins
 * Deve ser usado APÓS authMiddleware
 * 
 * Configuração: ADMIN_EMAILS no .env (separados por vírgula)
 * Exemplo: ADMIN_EMAILS="admin1@gmail.com,admin2@gmail.com"
 */
export function adminMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    // Verificar se usuário foi autenticado pelo middleware anterior
    if (!req.user || !req.user.email) {
      return res.status(401).json({
        success: false,
        error: 'Usuário não autenticado',
        message: 'authMiddleware deve ser executado antes de adminMiddleware'
      });
    }

    // Ler lista de emails admin do .env
    const adminEmails = process.env.ADMIN_EMAILS || '';
    
    if (!adminEmails) {
      console.error('⚠️  ADMIN_EMAILS não configurado no .env');
      return res.status(500).json({
        success: false,
        error: 'Sistema de administração não configurado',
        message: 'ADMIN_EMAILS não definido no servidor'
      });
    }

    // Converter para array e normalizar (trim + lowercase)
    const adminList = adminEmails
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0);

    const userEmail = req.user.email.toLowerCase();

    // Verificar se email está na whitelist
    if (!adminList.includes(userEmail)) {
      console.warn(`⚠️  Unauthorized admin access attempt: ${req.user.email}`);
      return res.status(403).json({
        success: false,
        error: 'Acesso negado',
        message: 'Você não tem permissão de administrador'
      });
    }

    next();

  } catch (error) {
    console.error('❌ Admin middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno ao verificar permissões',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
}
