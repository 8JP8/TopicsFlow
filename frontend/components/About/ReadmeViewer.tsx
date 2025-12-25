import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChevronDown, ChevronUp, Github, FileText } from 'lucide-react';

const ReadmeViewer: React.FC = () => {
    const { t } = useLanguage();
    const [isExpanded, setIsExpanded] = useState(false);

    const readmeContent = t('about.documentation') || `# TopicsFlow - Reddit-Style Discussion Platform

A comprehensive Reddit-style discussion platform. (Documentation not loaded)`;

    return (
        <div className="max-w-6xl mx-auto mb-20 p-4 md:p-8 bg-slate-800/30 rounded-[3rem] border border-slate-700/50 backdrop-blur-sm relative overflow-hidden">
            {/* Subtle gradient background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-cyan-500/5 pointer-events-none"></div>

            <div className="relative z-10">
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-white">{t('about.readmeViewer.title') || 'Project Documentation'}</h2>
                            <p className="text-slate-400 text-sm">{t('about.readmeViewer.subtitle') || 'Read the latest documentation directly from GitHub'}</p>
                        </div>
                    </div>

                    <a
                        href="https://github.com/8JP8/TopicsFlow"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-xl flex items-center gap-2 transition-all group"
                    >
                        <Github className="w-5 h-5 text-slate-300 group-hover:text-white" />
                        <span className="text-slate-300 group-hover:text-white font-medium">{t('about.readmeViewer.viewOnGithub') || 'View on GitHub'}</span>
                    </a>
                </div>

                <div
                    className={`
                        prose prose-invert max-w-none 
                        prose-headings:text-slate-200 prose-headings:font-bold prose-headings:scroll-mt-24
                        prose-h1:text-4xl prose-h1:mb-8 prose-h1:pb-4 prose-h1:border-b prose-h1:border-slate-800
                        prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-6 prose-h2:text-blue-200
                        prose-h3:text-xl prose-h3:mt-8 prose-h3:text-cyan-200
                        prose-p:text-slate-400 prose-p:leading-relaxed
                        prose-li:text-slate-400
                        prose-code:text-blue-300 prose-code:bg-slate-900/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                        prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 prose-pre:rounded-xl
                        prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
                        prose-strong:text-slate-200
                        prose-table:border-collapse prose-th:text-left prose-th:p-4 prose-th:bg-slate-800/50 prose-td:p-4 prose-td:border-b prose-td:border-slate-800
                        transition-all duration-700 ease-in-out relative
                        ${isExpanded ? 'active' : 'max-h-[500px] overflow-hidden mask-bottom'}
                    `}
                >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {readmeContent}
                    </ReactMarkdown>

                    {/* Fade overlay when collapsed */}
                    {!isExpanded && (
                        <div className="absolute bottom-0 left-0 w-full h-40 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none" />
                    )}
                </div>

                <div className="mt-8 flex justify-center">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 hover:text-blue-300 rounded-full font-medium transition-all group border border-blue-600/20 hover:border-blue-500/30"
                    >
                        {isExpanded ? (
                            <>
                                <span>{t('about.readmeViewer.showLess') || 'Show Less'}</span>
                                <ChevronUp className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
                            </>
                        ) : (
                            <>
                                <span>{t('about.readmeViewer.readFull') || 'Read Full Documentation'}</span>
                                <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReadmeViewer;
