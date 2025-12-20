import React from 'react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import {
    Users,
    MessageSquare,
    Mic2,
    ShieldCheck,
    Fingerprint,
    LifeBuoy,
    Zap,
    Layout
} from 'lucide-react';

const FeatureShowcase: React.FC = () => {
    const { t } = useLanguage();

    const features = [
        {
            title: t('about.features.publications.title') || 'Dynamic Publications',
            description: t('about.features.publications.desc') || 'Reddit-style community spaces where you can share posts, vote, and engage in meaningful discussions within specialized Topics.',
            icon: <Layout className="w-8 h-8 text-blue-400" />,
            color: 'from-blue-500/20 to-cyan-500/20',
            borderColor: 'border-blue-500/30'
        },
        {
            title: t('about.features.groupchats.title') || 'Group Chats',
            description: t('about.features.groupchats.desc') || 'Real-time rooms for every topic. Join active discussions and connect with the community instantly.',
            icon: <MessageSquare className="w-8 h-8 text-purple-400" />,
            color: 'from-purple-500/20 to-pink-500/20',
            borderColor: 'border-purple-500/30'
        },
        {
            title: t('about.features.chat.title') || 'Real-time Messaging',
            description: t('about.features.chat.desc') || 'Instant messaging for everyone. Start private conversations or participate in room chats with anyone.',
            icon: <Zap className="w-8 h-8 text-indigo-400" />,
            color: 'from-indigo-500/20 to-blue-500/20',
            borderColor: 'border-indigo-500/30'
        },
        {
            title: t('about.features.voip.title') || 'Voice Communication',
            description: t('about.features.voip.desc') || 'Crystal clear VOIP rooms within chats. Join or start voice calls seamlessly without leaving the app.',
            icon: <Mic2 className="w-8 h-8 text-green-400" />,
            color: 'from-green-500/20 to-emerald-500/20',
            borderColor: 'border-green-500/30'
        },
        {
            title: t('about.features.anonymous.title') || 'Anonymous Presence',
            description: t('about.features.anonymous.desc') || 'Engage with total privacy using our unique anonymous system. Custom names for every topic.',
            icon: <Fingerprint className="w-8 h-8 text-amber-400" />,
            color: 'from-amber-500/20 to-orange-500/20',
            borderColor: 'border-amber-500/30'
        },
        {
            title: t('about.features.safety.title') || 'Unmatched Safety',
            description: t('about.features.safety.desc') || 'Advanced moderation tools, content hiding, and blocking systems to keep your experience clean.',
            icon: <ShieldCheck className="w-8 h-8 text-red-400" />,
            color: 'from-red-500/20 to-rose-500/20',
            borderColor: 'border-red-500/30'
        }
    ];

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { y: 20, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: 'spring',
                stiffness: 100,
                damping: 12
            } as any
        }
    };

    return (
        <section className="py-20 px-6 max-w-7xl mx-auto">
            <div className="text-center mb-16">
                <motion.h2
                    initial={{ opacity: 0, y: -20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="text-4xl md:text-5xl font-bold theme-text-primary mb-4"
                >
                    {t('about.features.sectionTitle') || 'Everything you need to connect'}
                </motion.h2>
                <motion.p
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 }}
                    className="theme-text-secondary text-lg max-w-2xl mx-auto"
                >
                    {t('about.features.sectionSubtitle') || 'Discover the powerful tools that make TopicsFlow the ultimate discussion platform.'}
                </motion.p>
            </div>

            <motion.div
                variants={containerVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            >
                {features.map((feature, index) => (
                    <motion.div
                        key={index}
                        variants={itemVariants}
                        whileHover={{ y: -8, scale: 1.02 }}
                        className={`group relative p-8 rounded-[2.5rem] bg-gradient-to-br ${feature.color} border ${feature.borderColor} backdrop-blur-sm transition-all duration-300 hover:shadow-2xl hover:shadow-cyan-500/10`}
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Zap className="w-12 h-12" />
                        </div>

                        <div className="mb-6 p-3 bg-slate-900/40 rounded-2xl w-fit shadow-inner">
                            {feature.icon}
                        </div>

                        <h3 className="text-2xl font-bold theme-text-primary mb-4">
                            {feature.title}
                        </h3>

                        <p className="theme-text-secondary leading-relaxed">
                            {feature.description}
                        </p>

                        <div className="mt-8 flex items-center text-sm font-medium text-blue-400 group-hover:text-blue-300 transition-colors">
                            <span>{t('common.learnMore') || 'Learn more'}</span>
                            <svg className="ml-2 w-4 h-4 transform group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </div>
                    </motion.div>
                ))}
            </motion.div>
        </section>
    );
};

export default FeatureShowcase;
