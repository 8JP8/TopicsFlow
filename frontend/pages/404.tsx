import Head from 'next/head';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEffect, useMemo, useState } from 'react';

export default function Custom404() {
    const { t } = useLanguage();
    const [attemptedPath, setAttemptedPath] = useState<string>('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setAttemptedPath(window.location.pathname || '');
        }
    }, []);

    const suggestions = useMemo(() => {
        type Candidate = { href: string; label: string };

        const candidates: Candidate[] = [
            { href: '/', label: '/dashboard' },
            { href: '/login', label: '/login' },
            { href: '/register', label: '/register' },
            { href: '/about', label: '/about' },
            { href: '/recovery', label: '/recovery' },
            { href: '/settings', label: '/settings' },
        ];

        const norm = (s: string) => (s || '').toLowerCase().split('?')[0].split('#')[0].trim();

        // Simple Levenshtein similarity score in [0..1]
        const levenshtein = (a: string, b: string) => {
            if (a === b) return 0;
            if (!a) return b.length;
            if (!b) return a.length;
            const m = a.length;
            const n = b.length;
            const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
            for (let i = 0; i <= m; i++) dp[i][0] = i;
            for (let j = 0; j <= n; j++) dp[0][j] = j;
            for (let i = 1; i <= m; i++) {
                for (let j = 1; j <= n; j++) {
                    const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                    dp[i][j] = Math.min(
                        dp[i - 1][j] + 1,      // deletion
                        dp[i][j - 1] + 1,      // insertion
                        dp[i - 1][j - 1] + cost // substitution
                    );
                }
            }
            return dp[m][n];
        };

        const similarity = (a: string, b: string) => {
            const aa = norm(a);
            const bb = norm(b);
            const maxLen = Math.max(aa.length, bb.length, 1);
            return 1 - (levenshtein(aa, bb) / maxLen);
        };

        const input = norm(attemptedPath);
        if (!input) {
            return candidates.slice(0, 2);
        }

        return candidates
            .filter(c => norm(c.href) !== input)
            .map(c => ({ ...c, score: similarity(input, c.label) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 2);
    }, [attemptedPath]);

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
            <Head>
                <title>{`404 - ${t('errors.pageNotFound')} | ${t('common.appName')}`}</title>
            </Head>

            {/* Standard Fixed Header */}
            <div className="fixed top-0 left-0 right-0 z-50 p-4">
                <div className="flex justify-between items-center">
                    <Link href="/" className="flex items-center space-x-3 hover:opacity-80 transition-opacity cursor-pointer hover:no-underline no-underline">
                        <img
                            src="https://i.postimg.cc/FY5shL9w/chat.png"
                            alt="TopicsFlow Logo"
                            className="h-10 w-10"
                        />
                        <span className="text-xl font-bold text-white no-underline hover:no-underline">
                            {t('common.appName')}
                        </span>
                    </Link>
                </div>
            </div>

            {/* Background Blobs - Changed to Blue/Slate/Cyan */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[20%] left-[20%] w-72 h-72 bg-blue-500 rounded-full blur-[100px] opacity-10 animate-bounce-slow"></div>
                <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-cyan-600 rounded-full blur-[120px] opacity-10 animate-pulse"></div>
            </div>

            <div className="z-10 relative mt-8">
                {/* Animated Chat Bubble Illustration */}
                <div className="mb-4 relative w-72 h-72 md:w-80 md:h-80 mx-auto">
                    <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-2xl animate-pulse"></div>

                    {/* Bubble 1 */}
                    <div className="absolute top-0 right-0 animate-float-delay-1">
                        <div className="bg-blue-600 text-white p-4 rounded-2xl rounded-bl-none shadow-lg transform rotate-6 border border-blue-400/30">
                            <span className="text-3xl font-bold">404?</span>
                        </div>
                    </div>

                    {/* Bubble 2 */}
                    <div className="absolute bottom-10 left-0 animate-float-delay-2">
                        <div className="bg-slate-700 text-slate-200 p-4 rounded-2xl rounded-tr-none shadow-lg transform -rotate-6 border border-slate-600">
                            <span className="text-lg font-medium">{t('errors.whereAreWe')}</span>
                        </div>
                    </div>

                    {/* Central Question Mark */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <h1 className="text-[12rem] lg:text-[15rem] font-black text-slate-200 select-none opacity-20 leading-none">?</h1>
                    </div>
                </div>

                <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-white via-blue-200 to-cyan-400 mb-6 py-6 leading-[1.1] drop-shadow-2xl animate-fade-in px-4">
                    {t('errors.pageNotFound')}
                </h1>

                {/* Route Finder Suggestion */}
                <div className="mb-8 p-6 bg-slate-900/60 backdrop-blur-md rounded-2xl inline-block text-left max-w-sm mx-auto border border-slate-800 shadow-2xl transition-all hover:bg-slate-900/80">
                    <p className="text-slate-400 text-xs uppercase tracking-widest font-bold mb-3">{t('errors.didYouMean')}</p>
                    <ul className="space-y-3 font-medium text-sm">
                        {suggestions.map((s, idx) => (
                            <li key={`${s.href}-${idx}`}>
                                <Link
                                    href={s.href}
                                    className={`${idx === 0 ? 'text-blue-400 hover:text-blue-300' : 'text-cyan-400 hover:text-cyan-300'} transition-colors flex items-center group`}
                                >
                                    <span className="mr-2 opacity-50 group-hover:opacity-100">#</span>
                                    <span className="group-hover:underline">{s.label}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>

                <p className="text-lg text-slate-400 mb-10 max-w-lg mx-auto leading-relaxed font-medium px-4">
                    {t('errors.pageNotFoundDesc')}
                </p>

                <Link
                    href="/"
                    className="inline-flex items-center px-10 py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold rounded-2xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_25px_rgba(37,99,235,0.5)] transform hover:-translate-y-1 active:scale-95 group no-underline hover:no-underline"
                >
                    <svg className="w-5 h-5 mr-3 transform group-hover:-translate-x-1 transition-transform text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span className="text-white hover:text-white transition-colors drop-shadow-sm">
                        {t('common.goBackHome')}
                    </span>
                </Link>
            </div>

            <style jsx global>{`
        @keyframes float-delay-1 {
          0%, 100% { transform: translateY(0) rotate(6deg); }
          50% { transform: translateY(-15px) rotate(8deg); }
        }
        @keyframes float-delay-2 {
          0%, 100% { transform: translateY(0) -rotate(6deg); }
          50% { transform: translateY(-10px) -rotate(4deg); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-float-delay-1 {
          animation: float-delay-1 4s ease-in-out infinite;
        }
        .animate-float-delay-2 {
          animation: float-delay-2 5s ease-in-out infinite;
        }
        .animate-bounce-slow {
          animation: bounce 3s infinite;
        }
        .animate-fade-in {
          animation: fade-in 1s ease-out forwards;
        }
      `}</style>
        </div>
    );
}
