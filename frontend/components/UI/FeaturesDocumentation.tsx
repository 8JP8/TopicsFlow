import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

const FeaturesDocumentation: React.FC = () => {
    const { t } = useLanguage();
    const [activeTab, setActiveTab] = useState<'discussions' | 'chat' | 'privacy'>('discussions');

    const content = {
        discussions: {
            title: t('about.features.discussions.title') || "Structured Discussions",
            description: t('about.features.discussions.desc') || "Dive deep into specific interests with threaded conversations.",
            items: [
                {
                    title: t('about.features.discussions.richText.title') || "Rich Text Editing",
                    desc: t('about.features.discussions.richText.desc') || "Format your posts with markdown, code blocks, and more."
                },
                {
                    title: t('about.features.discussions.tagging.title') || "Tagging System",
                    desc: t('about.features.discussions.tagging.desc') || "Organize content and find exactly what you're looking for with robust tagging."
                },
                {
                    title: t('about.features.discussions.voting.title') || "Voting Mechanism",
                    desc: t('about.features.discussions.voting.desc') || "Upvote quality content to help the best ideas rise to the top."
                },
                {
                    title: t('about.features.discussions.media.title') || "Media Support",
                    desc: t('about.features.discussions.media.desc') || "Embed images, videos, and files directly into your posts."
                }
            ],
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
            )
        },
        chat: {
            title: t('about.features.chat.title') || "Real-Time Chat",
            description: t('about.features.chat.desc') || "Instant messaging for when you need answers now.",
            items: [
                {
                    title: t('about.features.chat.channels.title') || "Live Channels",
                    desc: t('about.features.chat.channels.desc') || "Jump into active rooms associated with any topic."
                },
                {
                    title: t('about.features.chat.dm.title') || "Direct Messaging",
                    desc: t('about.features.chat.dm.desc') || "Private conversations with friends or other community members."
                },
                {
                    title: t('about.features.chat.presence.title') || "Presence System",
                    desc: t('about.features.chat.presence.desc') || "See who's online and typing in real-time."
                },
                {
                    title: t('about.features.chat.media.title') || "GIFs & Emojis",
                    desc: t('about.features.chat.media.desc') || "Express yourself fully with integrated media pickers."
                }
            ],
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
            )
        },
        privacy: {
            title: t('about.features.privacy.title') || "Privacy & Control",
            description: t('about.features.privacy.desc') || "Your data, your identity, your rules.",
            items: [
                {
                    title: t('about.features.privacy.anonymous.title') || "Anonymous Mode",
                    desc: t('about.features.privacy.anonymous.desc') || "Participate without linking to your main profile."
                },
                {
                    title: t('about.features.privacy.invite.title') || "Invite-Only Topics",
                    desc: t('about.features.privacy.invite.desc') || "Create private spaces for teams or close groups."
                },
                {
                    title: t('about.features.privacy.activity.title') || "Activity Status",
                    desc: t('about.features.privacy.activity.desc') || "Control who sees when you were last online."
                },
                {
                    title: t('about.features.privacy.export.title') || "Data Export",
                    desc: t('about.features.privacy.export.desc') || "Download your data anytime. We don't lock you in."
                }
            ],
            icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
            )
        }
    };

    return (
        <div className="w-full max-w-6xl mx-auto px-4 py-16">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-12">
                {t('about.features.title') || "Platform Features"}
            </h2>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Navigation Tabs */}
                <div className="w-full md:w-1/3 space-y-2">
                    {Object.entries(content).map(([key, data]) => (
                        <button
                            key={key}
                            onClick={() => setActiveTab(key as any)}
                            className={`w-full text-left px-6 py-4 rounded-xl transition-all duration-300 flex items-center gap-4 ${activeTab === key
                                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg scale-105'
                                : 'bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                                }`}
                        >
                            <div className={`p-2 rounded-lg ${activeTab === key ? 'bg-white/20' : 'bg-slate-700/50'}`}>
                                {data.icon}
                            </div>
                            <span className="font-semibold text-lg">{data.title}</span>
                        </button>
                    ))}
                </div>

                {/* Content Display */}
                <div className="w-full md:w-2/3 bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-3xl p-8 relative overflow-hidden group">
                    {/* Background Glow */}
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-blue-500/20 transition-all duration-700"></div>

                    <div className="relative z-10 animate-fade-in key={activeTab}">
                        <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                            {content[activeTab].title}
                        </h3>
                        <p className="text-slate-400 mb-8 text-lg">
                            {content[activeTab].description}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {content[activeTab].items.map((item, index) => (
                                <div key={index} className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 hover:border-slate-600 transition-colors">
                                    <h4 className="text-blue-400 font-semibold mb-2">{item.title}</h4>
                                    <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FeaturesDocumentation;
