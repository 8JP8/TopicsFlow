import Head from 'next/head';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout/Layout';
import FeatureCarousel from '@/components/UI/FeatureCarousel';

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
                                <Link
                                    href="/"
                                    className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-blue-500/25 flex items-center group"
                                >
                                    <span className="mr-2">{t('about.goToDashboard') || 'Go to Dashboard'}</span>
                                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href="/login"
                                        className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
                                    >
                                        {t('auth.login')} / {t('auth.register')}
                                    </Link>
                                    <Link
                                        href="#tour"
                                        className="px-8 py-4 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-full font-bold text-lg transition-all border border-slate-600 hover:border-slate-500 backdrop-blur-sm"
                                    >
                                        Take a Tour
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>

                    {/* What is TopicsFlow Section */}
                    <div id="tour" className="mb-32 text-center max-w-4xl mx-auto scroll-mt-24">
                        <span className="text-blue-400 font-semibold tracking-wider uppercase text-sm mb-4 block">Discover the Platform</span>
                        <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">Redefining Online Communities</h2>
                        <p className="text-lg text-slate-300 leading-8">
                            TopicsFlow isn't just another forum. It's a cohesive ecosystem where Reddit-style structured discussions meet the immediacy of real-time chat rooms.
                            We've built a space where you can dive deep into long-form content or hang out in live channels, all with a seamless, modern interface.
                        </p>
                    </div>

                    {/* Feature Carousel Section */}
                    <div className="mb-32">
                        <div className="text-center mb-12">
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Everything You Need</h2>
                            <p className="text-slate-400">Explore the powerful features that make TopicsFlow unique.</p>
                        </div>
                        <FeatureCarousel />
                    </div>

                    {/* Detailed Features Grid / "Shit" (Rich Elements) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-6xl mx-auto mb-20 p-8 bg-slate-800/30 rounded-[3rem] border border-slate-700/50 backdrop-blur-sm">

                        {/* Text Content */}
                        <div className="flex flex-col justify-center space-y-8 p-4">
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-3 flex items-center">
                                    <span className="w-8 h-8 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center mr-3 text-sm">✓</span>
                                    Advanced Moderation
                                </h3>
                                <p className="text-slate-400 ml-11">
                                    Our built-in <span className="text-orange-300 font-medium">Ticket System</span> ensures community safety. Users can report content or behavior, and moderators have a dedicated dashboard to handle inquiries efficiently.
                                </p>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-3 flex items-center">
                                    <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mr-3 text-sm">✓</span>
                                    Seamless Sharing
                                </h3>
                                <p className="text-slate-400 ml-11">
                                    Share code snippets, images, and files effortlessly. With built-in drag-and-drop attachment support, your technical discussions don't have to be text-only.
                                </p>
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold text-white mb-3 flex items-center">
                                    <span className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center mr-3 text-sm">✓</span>
                                    Express Yourself
                                </h3>
                                <p className="text-slate-400 ml-11">
                                    Customize your profile, choose your theme, and find your community. Whether you're anonymous or a known regular, you belong here.
                                </p>
                            </div>
                        </div>

                        {/* Visual "Card" (PseudoUI) */}
                        <div className="relative hidden md:flex items-center justify-center">
                            <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-purple-500/10 rounded-2xl blur-xl"></div>
                            <div className="relative w-full max-w-sm bg-slate-900 border border-slate-700/50 rounded-2xl p-6 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
                                <div className="flex items-center space-x-3 mb-4">
                                    <div className="w-10 h-10 rounded-full bg-blue-500"></div>
                                    <div>
                                        <div className="h-2 w-24 bg-slate-700 rounded mb-1"></div>
                                        <div className="h-2 w-16 bg-slate-800 rounded"></div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div className="h-2 w-full bg-slate-800 rounded"></div>
                                    <div className="h-2 w-full bg-slate-800 rounded"></div>
                                    <div className="h-2 w-3/4 bg-slate-800 rounded"></div>
                                </div>
                                <div className="mt-4 flex space-x-2">
                                    <div className="h-20 w-full bg-slate-800/50 rounded-lg border border-slate-700 border-dashed flex items-center justify-center text-slate-600 text-xs">Attachment</div>
                                </div>
                            </div>
                        </div>
                    </div>

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
