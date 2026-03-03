/**
 * Lookup Riot account by Riot ID (gameName#tagline).
 *
 * Usage:
 *   npm run check-riot-account -- "Accez" "MACH3"
 *
 * Requires:
 *   RIOT_API_KEY in api/.env
 *   RIOT_API_PLATFORM (optional, default: americas)
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiKey = process.env.RIOT_API_KEY;
const platform = process.env.RIOT_API_PLATFORM || 'americas';

const [gameName, tagline] = process.argv.slice(2);

if (!apiKey) {
  console.error('RIOT_API_KEY não encontrado no .env');
  console.error('Verifique o arquivo kingsfantasy/api/.env');
  process.exit(1);
}

if (!/^RGAPI-[A-Za-z0-9\-]+$/.test(apiKey)) {
  console.error('RIOT_API_KEY parece inválida (formato inesperado)');
  process.exit(1);
}

if (!gameName || !tagline) {
  console.error('Uso: npm run check-riot-account -- "GameName" "TAG"');
  process.exit(1);
}

async function main() {
  try {
    const url = `https://${platform}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
      gameName
    )}/${encodeURIComponent(tagline)}`;

    const response = await axios.get(url, {
      headers: {
        'X-Riot-Token': apiKey,
      },
    });

    const { puuid, gameName: name, tagLine } = response.data;

    console.log('✅ Conta encontrada');
    console.log(`Riot ID: ${name}#${tagLine}`);
    console.log(`PUUID: ${puuid}`);
  } catch (error: any) {
    const status = error?.response?.status;
    const data = error?.response?.data;

    console.error('❌ Erro ao consultar a Riot API');
    if (status) {
      console.error(`Status: ${status}`);
    }
    if (data) {
      console.error('Resposta:', data);
    }
    process.exit(1);
  }
}

main();
