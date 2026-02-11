import Link from 'next/link';

export default function Home() {
  return (
    <main className="app-shell flex items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-6xl animate-fade-in">
        <section className="glass-panel rounded-[2rem] p-6 md:p-10 lg:p-12 relative overflow-hidden border border-primary/15">
          {/* Casino Gold Line */}
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />

          {/* Background Glow — Gold & Emerald */}
          <div className="absolute -right-28 -top-28 w-80 h-80 rounded-full bg-primary/15 blur-[120px]" />
          <div className="absolute -left-24 bottom-0 w-72 h-72 rounded-full bg-accent-emerald/10 blur-[120px]" />
          <div className="absolute right-1/4 bottom-1/4 w-40 h-40 rounded-full bg-accent-red/5 blur-[100px]" />

          <div className="relative grid lg:grid-cols-[1.2fr,0.8fr] gap-10 items-center">
            <div>
              <div className="chip-badge mb-5">
                <span className="material-icons text-[16px] text-primary">casino</span>
                Casino Game Show em Tempo Real
              </div>

              <h1 className="text-balance text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.02] uppercase">
                Caixa <span className="text-primary text-glow">Misteriosa</span>
              </h1>

              <p className="mt-5 text-base sm:text-lg text-white/60 max-w-2xl leading-relaxed">
                Um game show de cassino com rounds rápidos, trivia simultânea, caixas de risco e wildcards. Host no telão,
                jogadores no celular, tudo sincronizado via Socket.IO.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link href="/host" className="btn-primary px-7 py-4 inline-flex items-center justify-center gap-2 text-sm sm:text-base">
                  <span className="material-icons">tv</span>
                  Criar Mesa (Host)
                </Link>
                <Link href="/play" className="btn-ghost px-7 py-4 inline-flex items-center justify-center gap-2 text-sm sm:text-base">
                  <span className="material-icons">phone_iphone</span>
                  Entrar como Jogador
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-4 text-xs sm:text-sm text-white/45">
                <span className="inline-flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-accent-emerald animate-pulse" />
                  Mesma rede Wi-Fi
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="material-icons text-[16px] text-primary">groups</span>
                  3+ jogadores
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="material-icons text-[16px] text-accent-red">bolt</span>
                  Setup rápido
                </span>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <article className="surface-card">
                <p className="text-xs uppercase tracking-[0.16em] text-primary/50 flex items-center gap-1">
                  <span className="material-icons text-[12px]">style</span>
                  Round Flow
                </p>
                <h2 className="mt-2 text-xl font-black">Trivia → Ranking → Caixa</h2>
                <p className="mt-2 text-sm text-white/50">Rodadas curtas com mudança constante de liderança.</p>
              </article>

              <article className="surface-card">
                <p className="text-xs uppercase tracking-[0.16em] text-accent-red/60 flex items-center gap-1">
                  <span className="material-icons text-[12px]">local_fire_department</span>
                  Drama
                </p>
                <h2 className="mt-2 text-xl font-black">Duelo e Wildcards</h2>
                <p className="mt-2 text-sm text-white/50">Mecânicas de risco com impacto direto no placar.</p>
              </article>

              <article className="surface-card sm:col-span-2 lg:col-span-1">
                <p className="text-xs uppercase tracking-[0.16em] text-accent-emerald/60 flex items-center gap-1">
                  <span className="material-icons text-[12px]">devices</span>
                  Device Split
                </p>
                <h2 className="mt-2 text-xl font-black">Host + Mobile Players</h2>
                <p className="mt-2 text-sm text-white/50">Host com dashboard completo e UX mobile dedicada para resposta rápida.</p>
              </article>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
