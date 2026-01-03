import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout/Layout';
import { motion } from 'framer-motion';
import { ChevronDown, Shield, Lock, Users } from 'lucide-react';
import LoadingSpinner from '@/components/UI/LoadingSpinner';

// Lazy load heavy globe component only
const GlobeBackground = dynamic(() => import('@/components/UI/GlobeBackground'), {
    ssr: false
});

const ReadmeViewer = dynamic(() => import('@/components/About/ReadmeViewer'), {
    loading: () => <div className="h-[600px] flex items-center justify-center bg-slate-900/20 rounded-3xl animate-pulse" />,
    ssr: false
});

const FeatureCarousel = dynamic(() => import('@/components/About/FeatureCarousel'), {
    loading: () => <div className="h-96 flex items-center justify-center"><LoadingSpinner /></div>,
    ssr: false
});




interface FAQItem {
    question: string;
    answer: string;
}

export default function About() {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [openFAQ, setOpenFAQ] = useState<number | null>(null);

    const faqs: FAQItem[] = [
        {
            question: t('about.faq.q1') || 'What is TopicsFlow?',
            answer: t('about.faq.a1') || 'TopicsFlow is a modern discussion platform combining Reddit-style topics with real-time chat rooms, creating a seamless experience for communities.',
        },
        {
            question: t('about.faq.q2') || 'Is TopicsFlow free to use?',
            answer: t('about.faq.a2') || 'Yes! TopicsFlow is completely free to use. Create an account and start engaging with communities immediately.',
        },
        {
            question: t('about.faq.q3') || 'How do I create a topic?',
            answer: t('about.faq.a3') || 'Simply log in, navigate to the main page, and click "Create Topic". Fill in your title and content, then publish to the community.',
        },
        {
            question: t('about.faq.q4') || 'Can I remain anonymous?',
            answer: t('about.faq.a4') || 'Yes! TopicsFlow offers an anonymous mode. Toggle it in your settings to post without revealing your username.',
        },
        {
            question: t('about.faq.q5') || 'How are communities moderated?',
            answer: t('about.faq.a5') || 'We have a robust ticket system and dedicated moderators. Report inappropriate content and our team will review it promptly.',
        },
    ];

    return (
        <Layout transparentHeader>
            <Head>
                <title>{t('about.title') || 'About TopicsFlow - The Future of Discussion'}</title>
                <meta name="description" content={t('about.metaDescription') || 'TopicsFlow is a modern Reddit-style discussion platform with real-time chat rooms.'} />
            </Head>

            <div className="min-h-screen bg-slate-950 text-white overflow-hidden relative pb-20">
                {/* Animated Globe Background */}
                <GlobeBackground className="z-[2]" />

                {/* Subtle accent glows - behind globe */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-[1] pointer-events-none">
                    <div className="absolute top-[30%] right-[10%] w-[400px] h-[400px] bg-blue-600/5 rounded-full blur-[100px]"></div>
                    <div className="absolute bottom-[20%] left-[5%] w-[300px] h-[300px] bg-cyan-600/5 rounded-full blur-[100px]"></div>
                </div>

                <div className="relative z-10 container mx-auto px-4 pt-8 pointer-events-none">

                    {/* Hero Section */}
                    <div className="text-center max-w-5xl mx-auto mb-24 mt-24 pointer-events-auto">
                        <div className="relative inline-block">
                            <Link href="/" className="block hover:opacity-90 transition-opacity cursor-pointer">
                                <h1 className="text-5xl sm:text-6xl md:text-8xl font-black mb-6 text-white tracking-tight">
                                    <span className="bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent drop-shadow-2xl">
                                        {t('common.appName')}
                                    </span>
                                </h1>
                            </Link>
                            {/* Glow effect */}
                            <div className="absolute -inset-4 bg-blue-500/20 blur-3xl rounded-full -z-10"></div>
                        </div>
                        <p className="text-lg sm:text-xl md:text-2xl text-slate-300/90 mb-12 leading-relaxed max-w-3xl mx-auto font-light">
                            {t('about.heroSubtitle') || 'Where conversations flow naturally. A real-time community platform for modern discussions.'}
                        </p>

                        {/* CTA Buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mt-8">
                            {user ? (
                                <>
                                    <Link
                                        href="/"
                                        className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white hover:text-white active:text-white rounded-full font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-blue-500/25 flex items-center group no-underline hover:no-underline"
                                    >
                                        <span className="mr-2">{t('about.goToDashboard') || 'Go to Dashboard'}</span>
                                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                                    </Link>
                                    <Link
                                        href="/?startTour=true"
                                        className="px-8 py-4 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-full font-bold text-lg transition-all border border-slate-600 hover:border-slate-500 backdrop-blur-sm shadow-xl no-underline hover:no-underline hover:scale-105"
                                    >
                                        {t('about.takeATour') || 'Take the Tour'}
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Link
                                        href="/login"
                                        className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white hover:text-white active:text-white rounded-full font-bold text-lg transition-all transform hover:scale-105 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 no-underline hover:no-underline"
                                    >
                                        {t('auth.login')} / {t('auth.register')}
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>

                    {/* What is TopicsFlow Section */}
                    <div id="tour" className="mb-32 text-center max-w-4xl mx-auto scroll-mt-24 pointer-events-auto">
                        <span className="text-blue-400 font-semibold tracking-wider uppercase text-sm mb-4 block">
                            {t('about.discover.label') || 'Discover the Platform'}
                        </span>
                        <h2 className="text-4xl md:text-5xl font-bold text-white mb-8">
                            {t('about.discover.title') || 'Redefining Online Communities'}
                        </h2>
                        <p className="text-lg text-slate-300 leading-8 backdrop-blur-sm bg-slate-900/20 rounded-2xl p-6">
                            {t('about.discover.description') || "TopicsFlow isn't just another forum. It's a cohesive ecosystem where Reddit-style structured discussions meet the immediacy of real-time chat rooms. We've built a space where you can dive deep into long-form content or hang out in live channels, all with a seamless, modern interface."}
                        </p>

                        {/* Stacked Mockup Cards - Pointer events none on container, auto on cards */}
                        <div className="relative h-[420px] mt-12 flex items-center justify-center pointer-events-none">
                            {/* Chat Layout Card (Back) */}
                            <div className="absolute w-[90%] max-w-sm bg-slate-900/90 border border-slate-700/50 rounded-2xl p-4 shadow-2xl transform md:-rotate-6 md:translate-x-16 translate-y-4 backdrop-blur-sm hover:rotate-0 hover:translate-x-0 transition-all duration-500 z-10 pointer-events-auto">
                                <div className="flex items-center gap-2 mb-3 border-b border-slate-700/50 pb-2">
                                    <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
                                    <span className="text-slate-400 text-xs font-medium">General Chat</span>
                                    <span className="ml-auto text-slate-600 text-xs">3 online</span>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex gap-2">
                                        <div className="w-7 h-7 rounded-full bg-blue-500 shrink-0"></div>
                                        <div className="bg-slate-800/70 rounded-xl rounded-tl-sm px-3 py-2 max-w-[80%]">
                                            <p className="text-slate-400 text-xs">Hey everyone! 👋</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="w-7 h-7 rounded-full bg-emerald-500 shrink-0"></div>
                                        <div className="bg-slate-800/70 rounded-xl rounded-tl-sm px-3 py-2 max-w-[80%]">
                                            <p className="text-slate-400 text-xs">Welcome to the channel!</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <div className="bg-blue-600/80 rounded-xl rounded-tr-sm px-3 py-2 max-w-[80%]">
                                            <p className="text-white text-xs">Thanks! Excited to be here</p>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 flex gap-2">
                                    <div className="flex-1 bg-slate-800/50 rounded-full px-3 py-2 border border-slate-700/50">
                                        <span className="text-slate-600 text-xs">Type a message...</span>
                                    </div>
                                </div>
                            </div>

                            {/* Reddit Post Card (Front) */}
                            <div className="absolute w-[90%] max-w-sm bg-slate-900/90 border border-slate-700/50 rounded-2xl p-5 shadow-2xl transform md:rotate-3 md:-translate-x-16 -translate-y-4 backdrop-blur-sm hover:rotate-0 hover:translate-x-0 transition-all duration-500 z-20 pointer-events-auto">
                                <div className="flex gap-3">
                                    {/* Vote buttons */}
                                    <div className="flex flex-col items-center gap-1">
                                        <button className="text-slate-500 hover:text-blue-400">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                        </button>
                                        <span className="text-cyan-400 text-sm font-bold">247</span>
                                        <button className="text-slate-500 hover:text-red-400">
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                        </button>
                                    </div>
                                    {/* Post content */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-6 h-6 rounded-full bg-purple-500"></div>
                                            <span className="text-slate-400 text-xs">t/technology</span>
                                            <span className="text-slate-600 text-xs">• 3h</span>
                                        </div>
                                        <h4 className="text-white font-semibold text-sm mb-2">Introducing TopicsFlow: The Future of Online Discussion</h4>
                                        <div className="space-y-1.5">
                                            <div className="h-2 w-full bg-slate-800 rounded"></div>
                                            <div className="h-2 w-full bg-slate-800 rounded"></div>
                                            <div className="h-2 w-3/4 bg-slate-800 rounded"></div>
                                        </div>
                                        <div className="flex items-center gap-4 mt-3 text-slate-500 text-xs">
                                            <span className="flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                                42
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
                                                Share
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Modern Feature Explorer - Infinite Slider */}
                    <div className="mb-48 relative pointer-events-auto">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl h-64 bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />

                        <div className="text-center mb-4 px-4 overflow-hidden">
                            <motion.span
                                initial={{ opacity: 0, y: 10 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                className="text-blue-400 font-bold tracking-[0.3em] uppercase text-xs mb-4 block"
                            >
                                {t('about.features.label') || 'System Overview'}
                            </motion.span>
                            <motion.h2
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="text-4xl md:text-7xl font-black text-white mb-6 tracking-tight"
                            >
                                {t('about.features.title')}
                            </motion.h2>
                            <motion.p
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10"
                            >
                                {t('about.features.subtitle')}
                            </motion.p>
                        </div>

                        <FeatureCarousel />
                    </div>

                    {/* README Viewer Section */}
                    <div className="relative z-10 pointer-events-auto">
                        <ReadmeViewer />
                    </div>

                    {/* FAQs Section */}
                    <div className="max-w-3xl mx-auto mb-32 pointer-events-auto">
                        <div className="text-center mb-12">
                            <span className="text-blue-400 font-semibold tracking-wider uppercase text-sm mb-4 block">
                                {t('about.faq.label') || 'FAQ'}
                            </span>
                            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                                {t('about.faq.title') || 'Frequently Asked Questions'}
                            </h2>
                        </div>

                        <div className="space-y-4">
                            {faqs.map((faq, index) => (
                                <div
                                    key={index}
                                    className="bg-slate-800/40 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden transition-all hover:border-slate-600"
                                >
                                    <button
                                        onClick={() => setOpenFAQ(openFAQ === index ? null : index)}
                                        className="w-full px-6 py-4 text-left flex items-center justify-between"
                                    >
                                        <span className="font-semibold text-white">{faq.question}</span>
                                        <ChevronDown
                                            className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${openFAQ === index ? 'rotate-180' : ''}`}
                                        />
                                    </button>
                                    <div
                                        className={`px-6 overflow-hidden transition-all duration-300 ${openFAQ === index ? 'pb-4 max-h-40' : 'max-h-0'}`}
                                    >
                                        <p className="text-slate-400">{faq.answer}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <footer className="w-full py-6 px-8 mt-20 relative z-10 pointer-events-auto">
                    <div className="flex items-center justify-between">
                        <div className="text-left">
                            <p className="text-slate-400 text-sm font-medium">João Oliveira 1240369</p>
                            <p className="text-slate-500 text-xs">RINTE - MEEC ISEP 2025/2026</p>
                        </div>
                        <div className="flex items-center gap-6">
                            <a
                                href="https://github.com/8JP8/TopicsFlow"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                            >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.17 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.167 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
                                </svg>
                                <span className="text-sm">GitHub</span>
                            </a>
                            <a
                                href="https://www.isep.ipp.pt"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="opacity-70 hover:opacity-100 transition-opacity"
                            >
                                <img
                                    src="https://www.isep.ipp.pt/img/LogoIsep.png"
                                    alt="ISEP"
                                    className="h-8"
                                />
                            </a>
                        </div>
                    </div>
                </footer>



            </div>
        </Layout>
    );
}
