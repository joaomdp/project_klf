import React, { useEffect } from 'react';

export type LegalPage = 'privacy' | 'terms' | null;

interface LegalModalProps {
  page: LegalPage;
  onClose: () => void;
}

const SUPPORT_EMAIL = 'contato@fantasykings.com.br';

const PrivacyContent: React.FC = () => (
  <>
    <h2 className="font-orbitron font-black text-xl uppercase tracking-tight text-white mb-1">Política de Privacidade</h2>
    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-6">Atualizada em 21 de abril de 2026</p>

    <div className="space-y-5 text-sm text-gray-300 leading-relaxed">
      <p>
        A Kings Lendas Fantasy ("Kings Lendas", "nós") valoriza a sua privacidade. Esta Política descreve
        como coletamos, usamos e protegemos seus dados pessoais, em conformidade com a Lei Geral de Proteção
        de Dados (LGPD — Lei 13.709/2018).
      </p>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">1. Dados que coletamos</h3>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Cadastro:</strong> email, nome de invocador, nome do time, avatar, time favorito.</li>
          <li><strong>Uso:</strong> escalações, pontuações, ligas das quais participa.</li>
          <li><strong>Técnicos:</strong> endereço IP, navegador, logs de acesso (mantidos por até 6 meses por segurança).</li>
        </ul>
      </section>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">2. Como usamos</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Operar o fantasy (calcular pontuação, ranking, ligas).</li>
          <li>Autenticar sua conta e enviar códigos de verificação por email.</li>
          <li>Prevenir fraude e uso indevido.</li>
          <li>Melhorar a plataforma (analytics agregados, sem identificar você individualmente).</li>
        </ul>
      </section>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">3. Compartilhamento</h3>
        <p>
          Não vendemos seus dados. Compartilhamos apenas com provedores essenciais para operar o serviço:
          Supabase (banco de dados e autenticação), Brevo (envio de email), Render/Vercel (hospedagem),
          Google Gemini (AI Coach, apenas a pergunta digitada e dados públicos de mercado).
        </p>
      </section>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">4. Seus direitos (LGPD)</h3>
        <p>Você pode, a qualquer momento:</p>
        <ul className="list-disc list-inside space-y-1 mt-2">
          <li>Acessar, corrigir ou excluir seus dados.</li>
          <li>Revogar consentimento.</li>
          <li>Solicitar portabilidade dos dados.</li>
          <li>Reclamar à ANPD (Autoridade Nacional de Proteção de Dados).</li>
        </ul>
        <p className="mt-2">
          Para exercer: envie email para <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#3b82f6] hover:underline">{SUPPORT_EMAIL}</a>.
        </p>
      </section>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">5. Retenção</h3>
        <p>
          Mantemos seus dados enquanto sua conta estiver ativa. Após exclusão, mantemos por até 30 dias por
          questões técnicas de backup e, em seguida, removemos permanentemente.
        </p>
      </section>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">6. Segurança</h3>
        <p>
          Usamos HTTPS, senhas com hash, tokens JWT com expiração, rate limiting e Row Level Security no banco.
          Nenhum sistema é 100% seguro, mas empregamos boas práticas para proteger seus dados.
        </p>
      </section>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">7. Menores de idade</h3>
        <p>
          A plataforma é destinada a maiores de 13 anos. Menores devem ter consentimento de responsável legal.
        </p>
      </section>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">8. Contato do Encarregado (DPO)</h3>
        <p>
          Dúvidas sobre esta política: <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#3b82f6] hover:underline">{SUPPORT_EMAIL}</a>.
        </p>
      </section>
    </div>
  </>
);

const TermsContent: React.FC = () => (
  <>
    <h2 className="font-orbitron font-black text-xl uppercase tracking-tight text-white mb-1">Termos de Uso</h2>
    <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-6">Atualizados em 21 de abril de 2026</p>

    <div className="space-y-5 text-sm text-gray-300 leading-relaxed">
      <p>
        Ao criar uma conta na Kings Lendas Fantasy, você concorda com estes Termos. Leia com atenção.
      </p>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">1. O que é</h3>
        <p>
          Kings Lendas Fantasy é um jogo de fantasy gratuito baseado em campeonatos de League of Legends
          (CBLOL, LTA Sul e outros). Você monta um time virtual com jogadores reais e pontua conforme o
          desempenho deles nas partidas oficiais.
        </p>
      </section>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">2. Sem relação oficial</h3>
        <p>
          Kings Lendas Fantasy não é afiliada, endossada ou patrocinada pela Riot Games, LTA, CBLOL,
          times, jogadores ou qualquer organização do cenário competitivo. League of Legends é marca registrada
          da Riot Games, Inc.
        </p>
      </section>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">3. Conta e responsabilidade</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Você é responsável pela segurança da sua senha.</li>
          <li>Uma conta por pessoa. Contas secundárias ou múltiplas serão banidas.</li>
          <li>Proibido bot, script, ou qualquer automação para manipular ranking.</li>
          <li>Proibido assédio, linguagem ofensiva em nomes de time/liga.</li>
        </ul>
      </section>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">4. Regras do jogo</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Mercado abre e fecha conforme calendário das rodadas oficiais.</li>
          <li>Pontuação é calculada automaticamente após cada rodada.</li>
          <li>Preços dos jogadores oscilam conforme performance.</li>
          <li>Nome do time pode ser alterado a cada 30 dias.</li>
          <li>A equipe Kings Lendas pode revisar e reverter pontuações em caso de erro ou dados incorretos da fonte.</li>
        </ul>
      </section>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">5. Sem prêmios em dinheiro</h3>
        <p>
          Kings Lendas Fantasy é entretenimento. Não é jogo de azar, aposta ou fantasy pago. Não há prêmios
          em dinheiro. Eventuais promoções ou brindes são descritos em anúncios específicos.
        </p>
      </section>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">6. Propriedade intelectual</h3>
        <p>
          Logos, nomes de times e jogadores pertencem aos seus respectivos donos e são usados de forma
          informativa. O design, marca e código da Kings Lendas Fantasy são protegidos por direitos autorais.
        </p>
      </section>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">7. Suspensão e exclusão</h3>
        <p>
          Podemos suspender ou encerrar contas que violem estes Termos, sem aviso prévio em casos graves.
          Você pode excluir sua conta a qualquer momento via <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#3b82f6] hover:underline">{SUPPORT_EMAIL}</a>.
        </p>
      </section>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">8. Limitação de responsabilidade</h3>
        <p>
          Kings Lendas Fantasy é fornecida "como está". Não garantimos disponibilidade ininterrupta.
          Não nos responsabilizamos por danos indiretos decorrentes do uso ou indisponibilidade do serviço.
        </p>
      </section>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">9. Alterações</h3>
        <p>
          Podemos atualizar estes Termos a qualquer momento. Mudanças relevantes serão comunicadas por email
          ou aviso na plataforma. O uso continuado após a alteração implica aceite.
        </p>
      </section>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">10. Lei aplicável</h3>
        <p>
          Estes Termos são regidos pela legislação brasileira. Fica eleito o foro da comarca do domicílio do
          usuário para dirimir eventuais controvérsias.
        </p>
      </section>

      <section>
        <h3 className="font-black text-white uppercase text-xs tracking-widest mb-2">11. Contato</h3>
        <p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-[#3b82f6] hover:underline">{SUPPORT_EMAIL}</a>
        </p>
      </section>
    </div>
  </>
);

export const LegalModal: React.FC<LegalModalProps> = ({ page, onClose }) => {
  useEffect(() => {
    if (!page) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [page, onClose]);

  if (!page) return null;

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto custom-scrollbar bg-[#0F0F14] border border-white/10 rounded-3xl p-6 sm:p-10"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
        >
          <i className="fa-solid fa-xmark text-gray-400 text-sm"></i>
        </button>

        {page === 'privacy' ? <PrivacyContent /> : <TermsContent />}
      </div>
    </div>
  );
};

export default LegalModal;
