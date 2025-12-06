import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout/Layout';
import FeatureCarousel from '@/components/UI/FeatureCarousel';
import FeaturesDocumentation from '@/components/UI/FeaturesDocumentation';
import FAQs from '@/components/UI/FAQs';

export default function About() {
    const { user } = useAuth();
    const { t } = useLanguage();

    return (
        <Layout>
            <Head>
                <title>{t('about.title') || 'About TopicsFlow - The Future of Discussion'}</title>
                <meta name="description" content={t('about.metaDescription') || 'TopicsFlow is a modern Reddit-style discussion platform with real-time chat rooms.'} />
            </Head>

            <div className="min-h-screen bg-slate-900 text-white overflow-hidden relative pb-20">
                {/* Background Elements */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                    <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse"></div>
                    <div className="absolute top-[40%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '3s' }}></div>
                    <div className="absolute bottom-[-10%] right-[10%] w-[400px] h-[400px] bg-cyan-600/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1.5s' }}></div>
                </div>

                <div className="relative z-10 container mx-auto px-4 pt-20">

                    {/* Hero Section */}
                    <div className="text-center max-w-5xl mx-auto mb-20">
                        <h1 className="text-6xl md:text-7xl font-extrabold mb-8 text-white tracking-tight drop-shadow-lg">
                            {t('common.appName')}
                        </h1>
                        <p className="text-xl md:text-3xl text-slate-300 mb-10 leading-relaxed max-w-3xl mx-auto font-light">
                            {t('about.heroSubtitle') || 'Where conversations flow naturally. A real-time community platform for modern discussions.'}
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-8">
                            {user ? (
                                <>
                                    <Link
                                        href="/"
                                        className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-blue-500/25 flex items-center group"
                                    >
                                        <span className="mr-2">{t('about.goToDashboard') || 'Go to Dashboard'}</span>
                                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                    </Link>
                                    <button
                                        onClick={() => {
                                            if (typeof window !== 'undefined') {
                                                localStorage.setItem('start_tour', 'true');
                                                window.location.href = '/';
                                            }
                                        }}
                                        className="px-8 py-4 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-full font-bold text-lg transition-all border border-slate-600 hover:border-slate-500 backdrop-blur-sm cursor-pointer"
                                    >
                                        {t('about.tour.takeTour') || 'Take a Tour'}
                                    </button>
                                </>
                            ) : (
                                <Link
                                    href="/login"
                                    className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                                >
                                    {t('auth.login')} / {t('auth.register')}
                                </Link>
                            )}
                        </div>
                    </div>

                    {/* What is TopicsFlow Section */}
                    <div id="tour" className="mb-32 text-center max-w-4xl mx-auto scroll-mt-24">
                        <span className="text-blue-400 font-semibold tracking-wider uppercase text-sm mb-4 block">{t('about.tour.discover') || 'Discover the Platform'}</span>
                        <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">{t('about.tour.redefining') || 'Redefining Online Communities'}</h2>
                        <p className="text-lg text-slate-300 leading-8">
                            {t('about.tour.redefiningDesc') || "TopicsFlow isn't just another forum. It's a cohesive ecosystem where Reddit-style structured discussions meet the immediacy of real-time chat rooms. We've built a space where you can dive deep into long-form content or hang out in live channels, all with a seamless, modern interface."}
                        </p>
                    </div>

                    {/* Feature Carousel Section */}
                    <div className="mb-32">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t('about.tour.everything') || 'Everything You Need'}</h2>
                            <p className="text-slate-400">{t('about.tour.everythingDesc') || 'Explore the powerful features that make TopicsFlow unique.'}</p>
                        </div>
                        <FeatureCarousel />
                    </div>

                    {/* Features Documentation */}
                    <FeaturesDocumentation />

                    {/* FAQs Section */}
                    <FAQs />

                </div>

                {/* Footer */}
                <footer className="w-full p-8 text-center border-t border-slate-800/50 mt-20">
                    <p className="text-slate-500 text-sm">
                        &copy; {new Date().getFullYear()} {t('common.appName')}. {t('about.allRightsReserved') || 'All rights reserved.'}
                    </p>
                    <div className="flex justify-center space-x-6 mt-4 opacity-50">
                        {/* Dummy Social Icons */}
                        <div className="w-6 h-6 bg-slate-700 rounded-full"></div>
                        <div className="w-6 h-6 bg-slate-700 rounded-full"></div>
                        <div className="w-6 h-6 bg-slate-700 rounded-full"></div>
                    </div>
                </footer>
            </div>
        </Layout>
    );
}
