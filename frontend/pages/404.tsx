import Head from 'next/head';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Custom404() {
    const { t } = useLanguage();

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center px-4 relative overflow-hidden">
            <Head>
                <title>404 - {t('errors.pageNotFound') || 'Page Not Found'} | {t('common.appName')}</title>
            </Head>

            {/* Background Blobs - Changed to Blue/Slate/Cyan */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[20%] left-[20%] w-72 h-72 bg-blue-500 rounded-full blur-[100px] opacity-10 animate-bounce-slow"></div>
                <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-cyan-600 rounded-full blur-[120px] opacity-10 animate-pulse"></div>
            </div>

            <div className="z-10 relative">
                {/* Animated Chat Bubble Illustration */}
                <div className="mb-12 relative w-64 h-64 mx-auto">
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
                            {/* Styling improvements */}
                            <span className="text-lg font-medium">{t('errors.whereAreWe') || 'Where are we?'}</span>
                        </div>
                    </div>

                    {/* Central Question Mark */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <h1 className="text-9xl font-black text-slate-800 select-none opacity-40">?</h1>
                    </div>
                </div>

                <h2 className="text-4xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 mb-6 drop-shadow-sm">
                    {t('errors.pageNotFound') || 'Page Not Found'}
                </h2>
                <p className="text-xl text-slate-300 mb-10 max-w-lg mx-auto leading-relaxed">
                    {t('errors.pageNotFoundDesc') || "Looks like this discussion topic doesn't exist yet, or maybe it wandered off into the void."}
                </p>

                <Link
                    href="/"
                    className="inline-flex items-center px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-full transition-all shadow-lg hover:shadow-blue-500/30 group"
                >
                    <svg className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    {t('common.goBackHome') || 'Go Back Home'}
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
        .animate-float-delay-1 {
          animation: float-delay-1 4s ease-in-out infinite;
        }
        .animate-float-delay-2 {
          animation: float-delay-2 5s ease-in-out infinite;
        }
        .animate-bounce-slow {
          animation: bounce 3s infinite;
        }
      `}</style>
        </div>
    );
}
