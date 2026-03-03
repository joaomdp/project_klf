// Script 8: Validação completa do banco de dados
import { supabase } from '../config/supabase';
import { logger } from './utils/logger';
import * as constants from './utils/constants';
import { ValidationResult } from './utils/types';

async function validateAll() {
  logger.box([
    '✅ Kings Lendas Fantasy - Complete Validation',
    'Validando integridade do banco de dados...',
  ]);

  const results: ValidationResult[] = [];
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  try {
    // CATEGORIA 1: Contagem de Registros
    logger.section('CATEGORIA 1: Contagem de Registros');
    totalTests += 6;

    // Test 1.1: Teams
    const { data: teams } = await supabase.from('teams').select('*');
    const teamsTest = teams?.length === constants.TOTAL_TEAMS;
    results.push({
      category: 'Contagem',
      test: 'Teams',
      passed: teamsTest,
      message: `${teams?.length || 0}/${constants.TOTAL_TEAMS} times`,
    });
    logger.item(`Teams: ${teams?.length}/${constants.TOTAL_TEAMS}`, teamsTest ? 'success' : 'error');
    if (teamsTest) passedTests++; else failedTests++;

    // Test 1.2: Players
    const { data: players } = await supabase.from('players').select('*');
    const playersTest = players?.length === constants.TOTAL_PLAYERS;
    results.push({
      category: 'Contagem',
      test: 'Players',
      passed: playersTest,
      message: `${players?.length || 0}/${constants.TOTAL_PLAYERS} jogadores`,
    });
    logger.item(`Players: ${players?.length}/${constants.TOTAL_PLAYERS}`, playersTest ? 'success' : 'error');
    if (playersTest) passedTests++; else failedTests++;

    // Test 1.3: Champions
    const { data: champions } = await supabase.from('champions').select('*');
    const championsTest = champions?.length === constants.TOTAL_CHAMPIONS_EXPECTED;
    results.push({
      category: 'Contagem',
      test: 'Champions',
      passed: championsTest,
      message: `${champions?.length || 0}/${constants.TOTAL_CHAMPIONS_EXPECTED} campeões`,
    });
    logger.item(`Champions: ${champions?.length}/${constants.TOTAL_CHAMPIONS_EXPECTED}`, championsTest ? 'success' : 'error');
    if (championsTest) passedTests++; else failedTests++;

    // Test 1.4: Rounds
    const { data: rounds } = await supabase
      .from('rounds')
      .select('*')
      .eq('season', constants.CURRENT_SEASON);
    const roundsTest = rounds?.length === constants.TOTAL_ROUNDS;
    results.push({
      category: 'Contagem',
      test: 'Rounds',
      passed: roundsTest,
      message: `${rounds?.length || 0}/${constants.TOTAL_ROUNDS} rodadas (temporada ${constants.CURRENT_SEASON})`,
    });
    logger.item(`Rounds: ${rounds?.length}/${constants.TOTAL_ROUNDS}`, roundsTest ? 'success' : 'error');
    if (roundsTest) passedTests++; else failedTests++;

    // Test 1.5: Leagues
    const { data: leagues } = await supabase.from('leagues').select('*');
    const leaguesTest = leagues?.length === constants.TOTAL_LEAGUES;
    results.push({
      category: 'Contagem',
      test: 'Leagues',
      passed: leaguesTest,
      message: `${leagues?.length || 0}/${constants.TOTAL_LEAGUES} ligas`,
    });
    logger.item(`Leagues: ${leagues?.length}/${constants.TOTAL_LEAGUES}`, leaguesTest ? 'success' : 'error');
    if (leaguesTest) passedTests++; else failedTests++;

    // Test 1.6: System Configs
    const { data: configs } = await supabase.from('system_config').select('*');
    const configsTest = (configs?.length || 0) >= constants.TOTAL_CONFIGS_EXPECTED;
    results.push({
      category: 'Contagem',
      test: 'System Configs',
      passed: configsTest,
      message: `${configs?.length || 0} configs (mínimo: ${constants.TOTAL_CONFIGS_EXPECTED})`,
    });
    logger.item(`Configs: ${configs?.length} (mín: ${constants.TOTAL_CONFIGS_EXPECTED})`, configsTest ? 'success' : 'error');
    if (configsTest) passedTests++; else failedTests++;

    // CATEGORIA 2: Integridade de Preços
    logger.section('CATEGORIA 2: Integridade de Preços');
    totalTests += 3;

    const prices = players?.map(p => p.price) || [];
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // Test 2.1: Preço mínimo
    const minPriceTest = minPrice >= constants.MIN_PLAYER_PRICE;
    results.push({
      category: 'Preços',
      test: 'Preço Mínimo',
      passed: minPriceTest,
      message: `${minPrice.toFixed(1)} >= ${constants.MIN_PLAYER_PRICE}`,
    });
    logger.item(`Preço mínimo: ${minPrice.toFixed(1)} (esperado: >= ${constants.MIN_PLAYER_PRICE})`, minPriceTest ? 'success' : 'error');
    if (minPriceTest) passedTests++; else failedTests++;

    // Test 2.2: Preço máximo
    const maxPriceTest = maxPrice <= constants.MAX_PLAYER_PRICE;
    results.push({
      category: 'Preços',
      test: 'Preço Máximo',
      passed: maxPriceTest,
      message: `${maxPrice.toFixed(1)} <= ${constants.MAX_PLAYER_PRICE}`,
    });
    logger.item(`Preço máximo: ${maxPrice.toFixed(1)} (esperado: <= ${constants.MAX_PLAYER_PRICE})`, maxPriceTest ? 'success' : 'error');
    if (maxPriceTest) passedTests++; else failedTests++;

    // Test 2.3: Range de preços
    const priceRange = maxPrice - minPrice;
    const rangeTest = priceRange >= 5; // Deve haver variedade
    results.push({
      category: 'Preços',
      test: 'Variedade de Preços',
      passed: rangeTest,
      message: `Range: ${priceRange.toFixed(1)} (mínimo recomendado: 5)`,
    });
    logger.item(`Range de preços: ${priceRange.toFixed(1)}`, rangeTest ? 'success' : 'error');
    if (rangeTest) passedTests++; else failedTests++;

    // CATEGORIA 3: URLs de Imagens
    logger.section('CATEGORIA 3: URLs de Imagens');
    totalTests += 2;

    // Test 3.1: Teams URLs
    const teamsWithAbsoluteUrls = teams?.filter(t => t.logo_url?.startsWith('http')).length || 0;
    const teamsUrlsTest = teamsWithAbsoluteUrls === teams?.length;
    results.push({
      category: 'URLs',
      test: 'Teams Image URLs',
      passed: teamsUrlsTest,
      message: `${teamsWithAbsoluteUrls}/${teams?.length} com URLs absolutas`,
    });
    logger.item(`Teams com URLs absolutas: ${teamsWithAbsoluteUrls}/${teams?.length}`, teamsUrlsTest ? 'success' : 'error');
    if (teamsUrlsTest) passedTests++; else failedTests++;

    // Test 3.2: Players URLs
    const playersWithAbsoluteUrls = players?.filter(p => p.image?.startsWith('http')).length || 0;
    const playersUrlsTest = playersWithAbsoluteUrls === players?.length;
    results.push({
      category: 'URLs',
      test: 'Players Image URLs',
      passed: playersUrlsTest,
      message: `${playersWithAbsoluteUrls}/${players?.length} com URLs absolutas`,
    });
    logger.item(`Players com URLs absolutas: ${playersWithAbsoluteUrls}/${players?.length}`, playersUrlsTest ? 'success' : 'error');
    if (playersUrlsTest) passedTests++; else failedTests++;

    // CATEGORIA 4: Configurações do Sistema
    logger.section('CATEGORIA 4: Configurações do Sistema');
    totalTests += 5;

    const configMap = new Map(configs?.map(c => [c.key, c.value]) || []);

    // Test 4.1: Initial Budget
    const budgetValue = configMap.get('initial_budget');
    const budgetTest = budgetValue === constants.INITIAL_BUDGET.toString();
    results.push({
      category: 'Configs',
      test: 'Initial Budget',
      passed: budgetTest,
      message: `${budgetValue} (esperado: ${constants.INITIAL_BUDGET})`,
    });
    logger.item(`initial_budget = ${budgetValue} (esperado: ${constants.INITIAL_BUDGET})`, budgetTest ? 'success' : 'error');
    if (budgetTest) passedTests++; else failedTests++;

    // Test 4.2: Max Player Price
    const maxPriceValue = configMap.get('max_player_price');
    const maxPriceConfigTest = maxPriceValue === constants.MAX_PLAYER_PRICE.toString();
    results.push({
      category: 'Configs',
      test: 'Max Player Price',
      passed: maxPriceConfigTest,
      message: `${maxPriceValue} (esperado: ${constants.MAX_PLAYER_PRICE})`,
    });
    logger.item(`max_player_price = ${maxPriceValue} (esperado: ${constants.MAX_PLAYER_PRICE})`, maxPriceConfigTest ? 'success' : 'error');
    if (maxPriceConfigTest) passedTests++; else failedTests++;

    // Test 4.3: Min Player Price
    const minPriceValue = configMap.get('min_player_price');
    const minPriceConfigTest = minPriceValue === constants.MIN_PLAYER_PRICE.toString();
    results.push({
      category: 'Configs',
      test: 'Min Player Price',
      passed: minPriceConfigTest,
      message: `${minPriceValue} (esperado: ${constants.MIN_PLAYER_PRICE})`,
    });
    logger.item(`min_player_price = ${minPriceValue} (esperado: ${constants.MIN_PLAYER_PRICE})`, minPriceConfigTest ? 'success' : 'error');
    if (minPriceConfigTest) passedTests++; else failedTests++;

    // Test 4.4: Enable Analyst Rating
    const ratingEnabled = configMap.get('enable_analyst_rating');
    const ratingEnabledTest = ratingEnabled !== undefined;
    results.push({
      category: 'Configs',
      test: 'Analyst Rating Config',
      passed: ratingEnabledTest,
      message: ratingEnabledTest ? `${ratingEnabled} (configurado)` : 'Não encontrado',
    });
    logger.item(`enable_analyst_rating = ${ratingEnabled || 'N/A'}`, ratingEnabledTest ? 'success' : 'error');
    if (ratingEnabledTest) passedTests++; else failedTests++;

    // Test 4.5: Analyst Rating Weight
    const ratingWeight = configMap.get('analyst_rating_weight');
    const ratingWeightTest = ratingWeight === constants.ANALYST_RATING_WEIGHT.toString();
    results.push({
      category: 'Configs',
      test: 'Analyst Rating Weight',
      passed: ratingWeightTest,
      message: `${ratingWeight} (esperado: ${constants.ANALYST_RATING_WEIGHT})`,
    });
    logger.item(`analyst_rating_weight = ${ratingWeight} (esperado: ${constants.ANALYST_RATING_WEIGHT})`, ratingWeightTest ? 'success' : 'error');
    if (ratingWeightTest) passedTests++; else failedTests++;

    // CATEGORIA 5: Sistema de Rating (Estrutura)
    logger.section('CATEGORIA 5: Sistema de Rating (Estrutura)');
    totalTests += 1;

    // Test 5.1: Coluna analyst_rating existe
    try {
      const { error: ratingColumnError } = await supabase
        .from('player_performances')
        .select('analyst_rating')
        .limit(1);
      
      const ratingColumnTest = !ratingColumnError;
      results.push({
        category: 'Rating System',
        test: 'Coluna analyst_rating',
        passed: ratingColumnTest,
        message: ratingColumnTest ? 'Existe' : 'Não existe',
      });
      logger.item(`Coluna analyst_rating`, ratingColumnTest ? 'success' : 'warning');
      if (ratingColumnTest) passedTests++; else failedTests++;
    } catch (error: any) {
      results.push({
        category: 'Rating System',
        test: 'Coluna analyst_rating',
        passed: false,
        message: 'Erro ao verificar',
      });
      logger.item(`Coluna analyst_rating - Erro ao verificar`, 'warning');
      failedTests++;
    }

    // CATEGORIA 6: Viabilidade de Lineup
    logger.section('CATEGORIA 6: Viabilidade de Lineup');
    totalTests += 1;

    // Test 6.1: Lineup mais barato dentro do budget
    const roles = constants.ROLES;
    const cheapestLineup: any[] = [];
    let totalCost = 0;

    for (const role of roles) {
      const cheapestInRole = players
        ?.filter(p => p.role === role)
        .sort((a, b) => a.price - b.price)[0];
      
      if (cheapestInRole) {
        cheapestLineup.push(cheapestInRole);
        totalCost += cheapestInRole.price;
      }
    }

    const lineupTest = cheapestLineup.length === 5 && totalCost <= constants.INITIAL_BUDGET;
    results.push({
      category: 'Lineup',
      test: 'Lineup Mais Barato',
      passed: lineupTest,
      message: `${totalCost.toFixed(1)}/${constants.INITIAL_BUDGET} (${cheapestLineup.length}/5 jogadores)`,
      details: { lineup: cheapestLineup, totalCost },
    });
    logger.item(`Lineup mais barato: ${totalCost.toFixed(1)}/${constants.INITIAL_BUDGET}`, lineupTest ? 'success' : 'error');
    if (lineupTest) passedTests++; else failedTests++;

    // RESUMO FINAL
    logger.section('📊 RESUMO DA VALIDAÇÃO');
    
    const successRate = ((passedTests / totalTests) * 100).toFixed(1);
    
    logger.raw('');
    logger.raw(`  Total de Testes: ${totalTests}`);
    logger.raw(`  ${colors.green}✓ Passou: ${passedTests}${colors.reset}`);
    logger.raw(`  ${colors.red}✗ Falhou: ${failedTests}${colors.reset}`);
    logger.raw(`  Taxa de Sucesso: ${successRate}%`);
    logger.raw('');

    if (failedTests === 0) {
      logger.success('🎉 TODOS OS TESTES PASSARAM!');
      logger.info('Banco de dados está em perfeito estado.');
      logger.blank();
      logger.info('Sistema pronto para:');
      logger.raw('  ✓ Iniciar servidor (npm run dev)');
      logger.raw('  ✓ Cadastro de usuários');
      logger.raw('  ✓ Criação de times fantasy');
      logger.raw('  ✓ Entrada de resultados via admin panel');
      logger.blank();
    } else {
      logger.error(`${failedTests} teste(s) falharam!`);
      logger.blank();
      logger.info('Testes que falharam:');
      results.filter(r => !r.passed).forEach(r => {
        logger.raw(`  ❌ ${r.category} > ${r.test}: ${r.message}`);
      });
      logger.blank();
      logger.info('Para corrigir os problemas:');
      logger.raw('  npm run db:seed-all');
      logger.blank();
      process.exit(1);
    }

  } catch (error: any) {
    logger.error('Erro durante validação:');
    logger.error(error.message);
    process.exit(1);
  }
}

// Importar colors para usar no resumo
import { colors } from './utils/logger';

// Executar
validateAll();
