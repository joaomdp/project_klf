// Script 9: Orquestrador master - Executa todos os scripts em sequência
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger, colors } from './utils/logger';
import { ScriptExecutionResult } from './utils/types';

const execAsync = promisify(exec);

const scripts = [
  { number: 1, name: 'diagnose-database', description: 'Diagnóstico do Banco' },
  { number: 2, name: 'rebalance-prices', description: 'Rebalancear Preços' },
  { number: 3, name: 'fix-image-urls', description: 'Corrigir URLs de Imagens' },
  { number: 4, name: 'update-champions', description: 'Atualizar Campeões' },
  { number: 5, name: 'update-configs', description: 'Atualizar Configurações' },
  { number: 6, name: 'seed-more-rounds', description: 'Criar Rodadas' },
  { number: 7, name: 'add-analyst-rating', description: 'Preparar Sistema de Rating' },
  { number: 8, name: 'validate-all', description: 'Validação Final' },
];

async function seedAll() {
  logger.box([
    '🚀 Kings Lendas Fantasy - Complete Database Seeding',
    'Executando todos os scripts em sequência...',
  ]);

  const results: ScriptExecutionResult[] = [];
  const startTime = Date.now();

  try {
    for (const script of scripts) {
      logger.section(`[${script.number}/${scripts.length}] ${script.description}`);
      
      const scriptPath = `ts-node src/scripts/${script.number}-${script.name}.ts`;
      const scriptStartTime = Date.now();

      try {
        logger.info(`Executando: ${scriptPath}`);
        
        const { stdout, stderr } = await execAsync(scriptPath, {
          cwd: process.cwd(),
        });

        const duration = Date.now() - scriptStartTime;

        // Mostrar output do script
        if (stdout) {
          console.log(stdout);
        }

        if (stderr && !stderr.includes('ExperimentalWarning')) {
          logger.warning('Stderr output:');
          console.error(stderr);
        }

        logger.success(`✓ Script ${script.number} concluído em ${(duration / 1000).toFixed(1)}s`);
        
        results.push({
          scriptName: script.name,
          scriptNumber: script.number,
          success: true,
          duration,
          summary: `${script.description} - OK`,
        });

      } catch (error: any) {
        const duration = Date.now() - scriptStartTime;
        
        logger.error(`✗ Script ${script.number} falhou!`);
        
        if (error.stdout) {
          console.log(error.stdout);
        }
        
        if (error.stderr) {
          console.error(error.stderr);
        }

        results.push({
          scriptName: script.name,
          scriptNumber: script.number,
          success: false,
          duration,
          error: error.message,
          summary: `${script.description} - FALHOU`,
        });

        // Se não for o script de rating (que pode falhar se precisar criação manual), parar
        if (script.number !== 7) {
          logger.error('Execução interrompida devido a erro crítico.');
          logger.blank();
          logger.info('Para executar scripts individuais:');
          scripts.forEach(s => {
            logger.raw(`  npm run db:${s.name.replace(/-/g, '-')}`);
          });
          logger.blank();
          throw error;
        } else {
          logger.warning('Script de rating falhou (esperado se coluna precisa criação manual)');
          logger.info('Continuando com próximo script...');
        }
      }

      logger.blank();
    }

    // RESUMO FINAL
    const totalDuration = Date.now() - startTime;
    
    logger.box([
      '✅ SEEDING COMPLETO!',
      `Tempo total: ${(totalDuration / 1000).toFixed(1)}s`,
    ]);

    logger.section('📊 RESUMO DE EXECUÇÃO');
    
    results.forEach(r => {
      const statusIcon = r.success ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
      const durationStr = `${(r.duration / 1000).toFixed(1)}s`;
      const summary = r.summary || 'Unknown';
      logger.raw(`  ${statusIcon} [${r.scriptNumber}] ${summary.padEnd(45)} (${durationStr})`);
    });

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    logger.blank();
    logger.raw(`  Total: ${results.length} scripts`);
    logger.raw(`  ${colors.green}Sucesso: ${successCount}${colors.reset}`);
    if (failedCount > 0) {
      logger.raw(`  ${colors.red}Falhou: ${failedCount}${colors.reset}`);
    }

    logger.blank();

    if (failedCount === 0) {
      logger.success('🎉 Banco de dados populado e validado com sucesso!');
      logger.blank();
      logger.info('📋 Próximos Passos:');
      logger.raw('');
      logger.raw('  1. Iniciar servidor:');
      logger.raw('     npm run dev');
      logger.raw('');
      logger.raw('  2. Criar admin panel para:');
      logger.raw('     • Entrada manual de resultados');
      logger.raw('     • Controle de mercado');
      logger.raw('     • Gestão de rodadas');
      logger.raw('');
      logger.raw('  3. Quando quiser ativar ratings de analista:');
      logger.raw("     UPDATE system_config SET value = 'true'");
      logger.raw("     WHERE key = 'enable_analyst_rating';");
      logger.raw('');
      logger.raw('  4. Frontend:');
      logger.raw('     • Todas as imagens agora têm URLs absolutas');
      logger.raw('     • Budget do usuário será 60 moedas');
      logger.raw('     • Preços dos jogadores: 8-15');
      logger.raw('');
    } else {
      logger.warning(`${failedCount} script(s) falharam.`);
      logger.info('Verifique os erros acima e execute os scripts individualmente se necessário.');
    }

    logger.blank();
    logger.info('Para verificar o estado final do banco:');
    logger.raw('  npm run db:diagnose');
    logger.blank();

  } catch (error: any) {
    logger.error('Erro fatal durante execução dos scripts:');
    logger.error(error.message);
    process.exit(1);
  }
}

// Executar
seedAll();
