import cron from 'node-cron';
import { marketService } from '../services/market.service';
import { scoringService } from '../services/scoring.service';
import { autoImportService } from '../services/auto-import.service';
import { supabase } from '../config/supabase';

/**
 * CRON JOBS - AUTOMAÇÃO DO SISTEMA
 * 
 * Jobs agendados:
 * 1. Verificar fechamento do mercado (a cada minuto)
 * 2. Calcular pontuações (segunda-feira 9h)
 * 3. Reabrir mercado (terça-feira 00h)
 * 4. Atualizar status de rodadas (a cada 30 minutos)
 * 5. Auto-importar rodadas do Leaguepedia (domingo 23h)
 */

class CronJobsService {
  private jobs: any[] = [];

  /**
   * Inicia todos os cron jobs
   */
  startAllJobs() {
    console.log('⏰ Starting cron jobs...');

    // Job 1: Verificar fechamento do mercado (a cada minuto)
    const marketCheckJob = cron.schedule('* * * * *', async () => {
      console.log('🔍 [CRON] Checking if market should close...');
      try {
        const result = await marketService.checkAndCloseMarket();
        if (result.closed) {
          console.log(`✅ [CRON] Market closed for round ${result.roundId}`);
        } else {
          console.log('ℹ️  [CRON] Market remains open');
        }
      } catch (error) {
        console.error('❌ [CRON] Error checking market close:', error);
      }
    });

    // Job 2: Calcular pontuações (segunda-feira 9h)
    const scoringJob = cron.schedule('0 9 * * 1', async () => {
      console.log('📊 [CRON] Calculating scores for completed rounds...');
      try {
        // Buscar rodadas finalizadas que ainda não tiveram pontuação calculada
        // DB usa 'closed' para rodadas encerradas e 'finished' para finalizadas
        const { data: rounds } = await supabase
          .from('rounds')
          .select('id, round_number')
          .in('status', ['closed', 'finished'])
          .order('start_date', { ascending: false })
          .limit(1);

        if (rounds && rounds.length > 0) {
          const round = rounds[0];
          console.log(`📊 [CRON] Calculating scores for round ${round.round_number}...`);
          
          const result = await scoringService.calculateAllScoresForRound(round.id);
          console.log(`✅ [CRON] Scores calculated: ${result?.successCount} success, ${result?.errorCount} errors`);
        } else {
          console.log('ℹ️  [CRON] No completed rounds to calculate');
        }
      } catch (error) {
        console.error('❌ [CRON] Error calculating scores:', error);
      }
    });

    // Job 3: Reabrir mercado (terça-feira 00h)
    const marketReopenJob = cron.schedule('0 0 * * 2', async () => {
      console.log('🔓 [CRON] Reopening market...');
      try {
        await marketService.openMarket();
        console.log('✅ [CRON] Market reopened successfully');
      } catch (error) {
        console.error('❌ [CRON] Error reopening market:', error);
      }
    });

    // Job 4: Atualizar status de rodadas (a cada 30 minutos)
    const roundStatusJob = cron.schedule('*/30 * * * *', async () => {
      console.log('🔄 [CRON] Updating round statuses...');
      try {
        const now = new Date();

        // Atualizar rodadas que já começaram (pending -> open)
        // DB status: pending = aguardando, open = em andamento, closed = encerrada, finished = finalizada
        const { data: pendingRounds } = await supabase
          .from('rounds')
          .select('id, start_date')
          .eq('status', 'pending');

        if (pendingRounds) {
          for (const round of pendingRounds) {
            const startDate = new Date(round.start_date);
            if (now >= startDate) {
              await supabase
                .from('rounds')
                .update({ status: 'open' })
                .eq('id', round.id);
              console.log(`✅ [CRON] Round ${round.id} status: pending -> open`);
            }
          }
        }

        // Atualizar rodadas que já terminaram (open -> closed)
        const { data: openRounds } = await supabase
          .from('rounds')
          .select('id, end_date')
          .eq('status', 'open');

        if (openRounds) {
          for (const round of openRounds) {
            if (round.end_date) {
              const endDate = new Date(round.end_date);
              if (now >= endDate) {
                await supabase
                  .from('rounds')
                  .update({ status: 'closed' })
                  .eq('id', round.id);
                console.log(`✅ [CRON] Round ${round.id} status: open -> closed`);
              }
            }
          }
        }

        console.log('✅ [CRON] Round statuses updated');
      } catch (error) {
        console.error('❌ [CRON] Error updating round statuses:', error);
      }
    });

    // Job 5: Auto-importar rodadas do Leaguepedia (domingo 23h)
    const autoImportJob = cron.schedule('0 23 * * 0', async () => {
      console.log('📥 [CRON] Auto-importing round from Leaguepedia...');
      try {
        // Buscar season mais recente do banco ao invés de hardcodar
        const { data: latestRound } = await supabase
          .from('rounds')
          .select('season, round_number')
          .order('season', { ascending: false })
          .order('round_number', { ascending: false })
          .limit(1);

        const currentSeason = latestRound && latestRound.length > 0 ? latestRound[0].season : 1;
        const nextRound = latestRound && latestRound.length > 0 ? latestRound[0].round_number + 1 : 1;
        
        console.log(`📥 [CRON] Importing Season ${currentSeason} Round ${nextRound}...`);
        
        const overviewPage = autoImportService.getOverviewPage(currentSeason);
        const result = await autoImportService.importRound(overviewPage, nextRound);
        
        if (result.success) {
          console.log(`✅ [CRON] Import successful: ${result.matchesImported} matches, ${result.performancesImported} performances`);
        } else {
          console.error(`❌ [CRON] Import failed:`, result.errors);
        }
      } catch (error) {
        console.error('❌ [CRON] Error auto-importing round:', error);
      }
    });

    this.jobs = [marketCheckJob, scoringJob, marketReopenJob, roundStatusJob, autoImportJob];

    console.log('✅ All cron jobs started:');
    console.log('   1. Market check: Every minute (* * * * *)');
    console.log('   2. Score calculation: Monday 9am (0 9 * * 1)');
    console.log('   3. Market reopen: Tuesday 12am (0 0 * * 2)');
    console.log('   4. Round status update: Every 30 minutes (*/30 * * * *)');
    console.log('   5. Auto-import: Sunday 11pm (0 23 * * 0)');
  }

  /**
   * Para todos os cron jobs
   */
  stopAllJobs() {
    console.log('⏰ Stopping all cron jobs...');
    this.jobs.forEach(job => job.stop());
    console.log('✅ All cron jobs stopped');
  }

  /**
   * Executa manualmente o job de fechamento de mercado
   */
  async runMarketCheckNow() {
    console.log('🔍 [MANUAL] Running market check job...');
    try {
      const result = await marketService.checkAndCloseMarket();
      if (result.closed) {
        return { success: true, message: `Market closed for round ${result.roundId}` };
      } else {
        return { success: true, message: 'Market remains open' };
      }
    } catch (error) {
      console.error('❌ [MANUAL] Error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Executa manualmente o job de cálculo de pontuações
   */
  async runScoringJobNow(roundId: number) {
    console.log(`📊 [MANUAL] Running scoring job for round ${roundId}...`);
    try {
      const result = await scoringService.calculateAllScoresForRound(roundId);
      return { 
        success: true, 
        message: `Scores calculated: ${result?.successCount} success, ${result?.errorCount} errors`,
        result
      };
    } catch (error) {
      console.error('❌ [MANUAL] Error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Executa manualmente o job de reabertura de mercado
   */
  async runMarketReopenNow() {
    console.log('🔓 [MANUAL] Running market reopen job...');
    try {
      await marketService.openMarket();
      return { success: true, message: 'Market reopened successfully' };
    } catch (error) {
      console.error('❌ [MANUAL] Error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Executa manualmente o job de auto-import
   */
  async runAutoImportNow(season: number, roundNumber: number) {
    console.log(`📥 [MANUAL] Running auto-import job for Season ${season} Round ${roundNumber}...`);
    try {
      const overviewPage = autoImportService.getOverviewPage(season);
      const result = await autoImportService.importRound(overviewPage, roundNumber);
      
      if (result.success) {
        return {
          success: true,
          message: `Import successful: ${result.matchesImported} matches, ${result.performancesImported} performances`,
          result
        };
      } else {
        return {
          success: false,
          message: 'Import failed',
          errors: result.errors,
          result
        };
      }
    } catch (error) {
      console.error('❌ [MANUAL] Error:', error);
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * Retorna informações sobre os jobs ativos
   */
  getJobsStatus() {
    return {
      totalJobs: this.jobs.length,
      jobs: [
        {
          name: 'Market Check',
          schedule: 'Every minute',
          cron: '* * * * *',
          description: 'Check if market should close at market_close_time'
        },
        {
          name: 'Score Calculation',
          schedule: 'Monday 9am',
          cron: '0 9 * * 1',
          description: 'Calculate fantasy points for completed rounds'
        },
        {
          name: 'Market Reopen',
          schedule: 'Tuesday 12am',
          cron: '0 0 * * 2',
          description: 'Reopen market for new round'
        },
        {
          name: 'Round Status Update',
          schedule: 'Every 30 minutes',
          cron: '*/30 * * * *',
          description: 'Update round statuses (upcoming -> live -> completed)'
        },
        {
          name: 'Auto-Import from Leaguepedia',
          schedule: 'Sunday 11pm',
          cron: '0 23 * * 0',
          description: 'Automatically import match data from Leaguepedia'
        }
      ]
    };
  }
}

export const cronJobsService = new CronJobsService();
