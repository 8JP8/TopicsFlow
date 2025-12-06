import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

interface FAQItem {
    question: string;
    answer: string;
}

const FAQs: React.FC = () => {
    const { t } = useLanguage();
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const faqs: FAQItem[] = [
        {
            question: t('about.faq.q1') || "What is TopicsFlow?",
            answer: t('about.faq.a1') || "TopicsFlow is a hybrid platform combining the best of structured forums and real-time chat. It allows you to create focused topics for long-term discussions while also providing immediate, live chat rooms for community bonding."
        },
        {
            question: t('about.faq.q2') || "How do I create a new topic?",
            answer: t('about.faq.a2') || "Simply click the 'Create Topic' button in the sidebar. You can customize it with a title, description, and tags. You can also choose if it's public or invite-only, and if anonymous posting is allowed."
        },
        {
            question: t('about.faq.q3') || "Is it free to use?",
            answer: t('about.faq.a3') || "Yes! TopicsFlow is completely free for all users. You can create topics, join chats, and share files without any cost."
        },
        {
            question: t('about.faq.q4') || "Can I stay anonymous?",
            answer: t('about.faq.a4') || "Absolutely. Many topics allow 'Anonymous Mode', letting you participate without revealing your main profile. You can even set a custom alias for each topic."
        },
        {
            question: t('about.faq.q5') || "How does moderation work?",
            answer: t('about.faq.a5') || "Topic owners can appoint moderators. Moderators have tools to delete messages, ban users, and manage requests. We also have a built-in reporting system for safety."
        }
    ];

    const toggleAccordion = (index: number) => {
        setActiveIndex(activeIndex === index ? null : index);
    };

    return (
        <div className="w-full max-w-4xl mx-auto px-4 py-12">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-white mb-12">
                {t('about.faq.title') || "Frequently Asked Questions"}
            </h2>
            <div className="space-y-4">
                {faqs.map((faq, index) => (
                    <div
                        key={index}
                        className={`bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-xl overflow-hidden transition-all duration-300 ${activeIndex === index ? 'shadow-lg shadow-blue-500/10' : 'hover:bg-slate-800/70'}`}
                    >
                        <button
                            className="w-full px-6 py-4 text-left flex items-center justify-between focus:outline-none"
                            onClick={() => toggleAccordion(index)}
                        >
                            <span className="text-lg font-medium text-slate-200">{faq.question}</span>
                            <svg
                                className={`w-5 h-5 text-blue-400 transform transition-transform duration-300 ${activeIndex === index ? 'rotate-180' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <div
                            className={`px-6 text-slate-400 leading-relaxed overflow-hidden transition-all duration-300 ease-in-out ${activeIndex === index ? 'max-h-96 py-4 border-t border-slate-700/50' : 'max-h-0 py-0'}`}
                        >
                            {faq.answer}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default FAQs;
