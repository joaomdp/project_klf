import cron from 'node-cron';
import { marketService } from '../services/market.service';
import { scoringService } from '../services/scoring.service';
import { supabase } from '../config/supabase';

/**
 * CRON JOBS - AUTOMACAO DO SISTEMA
 *
 * Jobs agendados:
 * 1. Verificar fechamento do mercado (a cada minuto)
 * 2. Calcular pontuacoes (segunda-feira 9h)
 * 3. Reabrir mercado (terca-feira 00h)
 * 4. Atualizar status de rodadas (a cada 30 minutos)
 */

class CronJobsService {
  private jobs: any[] = [];

  startAllJobs() {
    console.log('Starting cron jobs...');

    // Job 1: Verificar fechamento do mercado (a cada minuto)
    const marketCheckJob = cron.schedule('* * * * *', async () => {
      try {
        const result = await marketService.checkAndCloseMarket();
        if (result.closed) {
          console.log(`[CRON] Market closed for round ${result.roundId}`);
        }
      } catch (error) {
        console.error('[CRON] Error checking market close:', error);
      }
    });

    // Job 2: Calcular pontuacoes (segunda-feira 9h)
    const scoringJob = cron.schedule('0 9 * * 1', async () => {
      console.log('[CRON] Calculating scores for completed rounds...');
      try {
        const { data: rounds } = await supabase
          .from('rounds')
          .select('id, round_number')
          .in('status', ['completed'])
          .order('start_date', { ascending: false })
          .limit(1);

        if (rounds && rounds.length > 0) {
          const round = rounds[0];
          const result = await scoringService.calculateAllScoresForRound(round.id);
          console.log(`[CRON] Scores calculated: ${result?.successCount} success, ${result?.errorCount} errors`);
        }
      } catch (error) {
        console.error('[CRON] Error calculating scores:', error);
      }
    });

    // Job 3: Reabrir mercado (terca-feira 00h)
    const marketReopenJob = cron.schedule('0 0 * * 2', async () => {
      console.log('[CRON] Reopening market...');
      try {
        await marketService.openMarket();
        console.log('[CRON] Market reopened successfully');
      } catch (error) {
        console.error('[CRON] Error reopening market:', error);
      }
    });

    // Job 4: Atualizar status de rodadas (a cada 30 minutos)
    const roundStatusJob = cron.schedule('*/30 * * * *', async () => {
      try {
        const now = new Date();

        // upcoming → live (quando start_date é atingido)
        const { data: upcomingRounds } = await supabase
          .from('rounds')
          .select('id, start_date')
          .eq('status', 'upcoming');

        if (upcomingRounds) {
          for (const round of upcomingRounds) {
            const startDate = new Date(round.start_date);
            if (now >= startDate) {
              await supabase
                .from('rounds')
                .update({ status: 'live' })
                .eq('id', round.id);
              console.log(`[CRON] Round ${round.id} status: upcoming -> live`);
            }
          }
        }

        // live → completed (quando end_date é atingido)
        const { data: liveRounds } = await supabase
          .from('rounds')
          .select('id, end_date')
          .eq('status', 'live');

        if (liveRounds) {
          for (const round of liveRounds) {
            if (round.end_date) {
              const endDate = new Date(round.end_date);
              if (now >= endDate) {
                await supabase
                  .from('rounds')
                  .update({ status: 'completed' })
                  .eq('id', round.id);
                console.log(`[CRON] Round ${round.id} status: live -> completed`);
              }
            }
          }
        }
      } catch (error) {
        console.error('[CRON] Error updating round statuses:', error);
      }
    });

    this.jobs = [marketCheckJob, scoringJob, marketReopenJob, roundStatusJob];

    console.log('All cron jobs started:');
    console.log('   1. Market check: Every minute');
    console.log('   2. Score calculation: Monday 9am');
    console.log('   3. Market reopen: Tuesday 12am');
    console.log('   4. Round status update: Every 30 minutes');
  }

  stopAllJobs() {
    this.jobs.forEach(job => job.stop());
  }

  async runMarketCheckNow() {
    try {
      const result = await marketService.checkAndCloseMarket();
      if (result.closed) {
        return { success: true, message: `Market closed for round ${result.roundId}` };
      } else {
        return { success: true, message: 'Market remains open' };
      }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async runScoringJobNow(roundId: number) {
    try {
      const result = await scoringService.calculateAllScoresForRound(roundId);
      return {
        success: true,
        message: `Scores calculated: ${result?.successCount} success, ${result?.errorCount} errors`,
        result
      };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async runMarketReopenNow() {
    try {
      await marketService.openMarket();
      return { success: true, message: 'Market reopened successfully' };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  getJobsStatus() {
    return {
      totalJobs: this.jobs.length,
      jobs: [
        { name: 'Market Check', schedule: 'Every minute', cron: '* * * * *' },
        { name: 'Score Calculation', schedule: 'Monday 9am', cron: '0 9 * * 1' },
        { name: 'Market Reopen', schedule: 'Tuesday 12am', cron: '0 0 * * 2' },
        { name: 'Round Status Update', schedule: 'Every 30 minutes', cron: '*/30 * * * *' }
      ]
    };
  }
}

export const cronJobsService = new CronJobsService();
