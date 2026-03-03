/**
 * Riot Games API Service
 * 
 * Interface with Riot Games API to fetch match data automatically.
 * Includes rate limiting, retry logic, and caching.
 * 
 * API Documentation: https://developer.riotgames.com/apis
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Riot API Types
export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface RiotMatchParticipant {
  puuid: string;
  summonerName: string;
  championId: number;
  championName: string;
  teamId: number;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  doubleKills: number;
  tripleKills: number;
  quadraKills: number;
  pentaKills: number;
  firstBloodKill: boolean;
  win: boolean;
}

export interface RiotMatch {
  metadata: {
    matchId: string;
    participants: string[]; // PUUIDs
  };
  info: {
    gameCreation: number; // Timestamp
    gameDuration: number; // Seconds
    gameMode: string;
    gameType: string; // "CUSTOM_GAME" for tournaments
    participants: RiotMatchParticipant[];
  };
}

/**
 * Rate Limiter for Riot API
 * Development Key limits: 20/sec, 100/2min
 */
class RateLimiter {
  private requestsLastSecond: number = 0;
  private requestsLast2Minutes: number = 0;
  private lastSecondReset: number = Date.now();
  private last2MinutesReset: number = Date.now();

  private readonly PER_SECOND_LIMIT = 18; // Safe margin (20 max)
  private readonly PER_2_MINUTES_LIMIT = 90; // Safe margin (100 max)

  async waitIfNeeded(): Promise<void> {
    // Reset counters if time windows passed
    const now = Date.now();
    
    if (now - this.lastSecondReset >= 1000) {
      this.requestsLastSecond = 0;
      this.lastSecondReset = now;
    }

    if (now - this.last2MinutesReset >= 120000) {
      this.requestsLast2Minutes = 0;
      this.last2MinutesReset = now;
    }

    // Wait if limits exceeded
    while (
      this.requestsLastSecond >= this.PER_SECOND_LIMIT ||
      this.requestsLast2Minutes >= this.PER_2_MINUTES_LIMIT
    ) {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check again after waiting
      const nowAfterWait = Date.now();
      if (nowAfterWait - this.lastSecondReset >= 1000) {
        this.requestsLastSecond = 0;
        this.lastSecondReset = nowAfterWait;
      }
      if (nowAfterWait - this.last2MinutesReset >= 120000) {
        this.requestsLast2Minutes = 0;
        this.last2MinutesReset = nowAfterWait;
      }
    }

    // Increment counters
    this.requestsLastSecond++;
    this.requestsLast2Minutes++;
  }
}

class RiotAPIService {
  private apiKey: string;
  private region: string; // br1, na1, euw1, etc.
  private platform: string; // americas, europe, asia
  private accountClient: AxiosInstance;
  private platformClient: AxiosInstance;
  private rateLimiter: RateLimiter;
  private puuidCache: Map<string, string>; // summonerName -> PUUID

  constructor() {
    this.apiKey = process.env.RIOT_API_KEY || '';
    this.region = process.env.RIOT_API_REGION || 'br1';
    this.platform = process.env.RIOT_API_PLATFORM || 'americas';
    this.rateLimiter = new RateLimiter();
    this.puuidCache = new Map();

    if (!this.apiKey || this.apiKey.includes('COLOQUE-SUA')) {
      throw new Error(
        '❌ Riot API Key não configurada! Configure RIOT_API_KEY no arquivo .env'
      );
    }

    // Account API (regional)
    this.accountClient = axios.create({
      baseURL: `https://${this.platform}.api.riotgames.com`,
      headers: {
        'X-Riot-Token': this.apiKey
      }
    });

    // Platform API (by region)
    this.platformClient = axios.create({
      baseURL: `https://${this.region}.api.riotgames.com`,
      headers: {
        'X-Riot-Token': this.apiKey
      }
    });
  }

  /**
   * Get PUUID from summoner name
   * Uses cache to avoid repeated API calls
   */
  async getPUUID(summonerName: string, tagLine: string = 'BR1'): Promise<string | null> {
    const cacheKey = `${summonerName}#${tagLine}`;
    
    if (this.puuidCache.has(cacheKey)) {
      return this.puuidCache.get(cacheKey)!;
    }

    try {
      await this.rateLimiter.waitIfNeeded();
      
      const response = await this.accountClient.get<RiotAccount>(
        `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(summonerName)}/${tagLine}`
      );

      const puuid = response.data.puuid;
      this.puuidCache.set(cacheKey, puuid);
      
      return puuid;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 404) {
          console.warn(`⚠️  Jogador não encontrado: ${summonerName}#${tagLine}`);
          return null;
        }
        console.error(`❌ Erro ao buscar PUUID de ${summonerName}:`, axiosError.message);
      }
      return null;
    }
  }

  /**
   * Get match IDs for a player in a date range
   */
  async getMatchIds(
    puuid: string,
    startTime: number, // Unix timestamp (seconds)
    endTime: number,
    count: number = 100
  ): Promise<string[]> {
    try {
      await this.rateLimiter.waitIfNeeded();

      const response = await this.platformClient.get<string[]>(
        `/lol/match/v5/matches/by-puuid/${puuid}/ids`,
        {
          params: {
            startTime,
            endTime,
            count,
            type: 'custom' // Only custom games (tournaments)
          }
        }
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        console.error(`❌ Erro ao buscar partidas:`, axiosError.message);
      }
      return [];
    }
  }

  /**
   * Get detailed match information
   */
  async getMatchDetails(matchId: string): Promise<RiotMatch | null> {
    try {
      await this.rateLimiter.waitIfNeeded();

      const response = await this.platformClient.get<RiotMatch>(
        `/lol/match/v5/matches/${matchId}`
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 429) {
          console.warn('⚠️  Rate limit atingido, aguardando...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          return this.getMatchDetails(matchId); // Retry
        }
        console.error(`❌ Erro ao buscar detalhes da partida ${matchId}:`, axiosError.message);
      }
      return null;
    }
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to get a known summoner (Faker as example)
      await this.rateLimiter.waitIfNeeded();
      await this.accountClient.get('/riot/account/v1/accounts/by-riot-id/Hide on bush/KR1');
      console.log('✅ Riot API conectada com sucesso!');
      return true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response?.status === 403) {
          console.error('❌ API Key inválida ou expirada!');
        } else {
          console.error('❌ Erro ao conectar com Riot API:', axiosError.message);
        }
      }
      return false;
    }
  }

  /**
   * Get rate limiter stats (for debugging)
   */
  getRateLimiterStats() {
    return {
      requestsLastSecond: (this.rateLimiter as any).requestsLastSecond,
      requestsLast2Minutes: (this.rateLimiter as any).requestsLast2Minutes
    };
  }
}

// Singleton instance
export const riotAPIService = new RiotAPIService();
