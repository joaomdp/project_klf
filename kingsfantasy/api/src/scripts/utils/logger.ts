// Sistema de logging colorido para os scripts de seed

export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Cores de texto
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  
  // Cores de fundo
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgCyan: '\x1b[46m',
};

export const logger = {
  // Informação geral
  info: (message: string) => {
    console.log(`${colors.blue}[INFO]${colors.reset} ${message}`);
  },
  
  // Sucesso
  success: (message: string) => {
    console.log(`${colors.green}✅${colors.reset} ${message}`);
  },
  
  // Aviso
  warning: (message: string) => {
    console.log(`${colors.yellow}⚠️${colors.reset}  ${message}`);
  },
  
  // Erro
  error: (message: string) => {
    console.log(`${colors.red}❌${colors.reset} ${message}`);
  },
  
  // Seção (header grande)
  section: (message: string) => {
    console.log();
    console.log(`${colors.cyan}${colors.bright}━━━ ${message} ━━━${colors.reset}`);
    console.log();
  },
  
  // Subsection (header menor)
  subsection: (message: string) => {
    console.log();
    console.log(`${colors.cyan}${message}${colors.reset}`);
  },
  
  // Box decorado
  box: (lines: string[]) => {
    const maxLength = Math.max(...lines.map(l => l.length));
    const border = '─'.repeat(maxLength + 4);
    
    console.log();
    console.log(`${colors.cyan}┌${border}┐${colors.reset}`);
    lines.forEach(line => {
      const padding = ' '.repeat(maxLength - line.length);
      console.log(`${colors.cyan}│${colors.reset}  ${line}${padding}  ${colors.cyan}│${colors.reset}`);
    });
    console.log(`${colors.cyan}└${border}┘${colors.reset}`);
    console.log();
  },
  
  // Progresso de etapa
  step: (current: number, total: number, message: string) => {
    console.log(`${colors.cyan}[${current}/${total}]${colors.reset} ${colors.bright}${message}${colors.reset}`);
  },
  
  // Item de lista
  item: (message: string, status: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const icons = {
      success: `${colors.green}✓${colors.reset}`,
      error: `${colors.red}✗${colors.reset}`,
      warning: `${colors.yellow}!${colors.reset}`,
      info: `${colors.blue}•${colors.reset}`,
    };
    console.log(`   ${icons[status]} ${message}`);
  },
  
  // Tabela simples
  table: (headers: string[], rows: string[][]) => {
    console.log();
    
    // Header
    console.log(`${colors.bright}${headers.join(' | ')}${colors.reset}`);
    console.log('─'.repeat(headers.join(' | ').length));
    
    // Rows
    rows.forEach(row => {
      console.log(row.join(' | '));
    });
    
    console.log();
  },
  
  // Log simples sem formatação
  raw: (message: string) => {
    console.log(message);
  },
  
  // Linha em branco
  blank: () => {
    console.log();
  },
};
