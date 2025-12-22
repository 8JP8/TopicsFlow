import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, MessageSquare, Users, Mic2, ShieldCheck, Fingerprint, LifeBuoy, Zap, Bell, Shield } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import * as Mockups from './FeatureMockups';

interface FeatureModalProps {
    isOpen: boolean;
    onClose: () => void;
    featureKey: string;
    allFeatures: any[];
    onNavigate: (index: number) => void;
}

const gradientMap: Record<string, string> = {
    blue: 'from-blue-600/20 to-blue-900/40',
    purple: 'from-purple-600/20 to-purple-900/40',
    emerald: 'from-emerald-600/20 to-emerald-900/40',
    cyan: 'from-cyan-600/20 to-cyan-900/40',
    orange: 'from-orange-600/20 to-orange-900/40',
    red: 'from-red-600/20 to-red-900/40',
    yellow: 'from-yellow-600/20 to-yellow-900/40',
    indigo: 'from-indigo-600/20 to-indigo-900/40',
};

const hexColorMap: Record<string, string> = {
    blue: 'rgb(59, 130, 246)',
    purple: 'rgb(168, 85, 247)',
    emerald: 'rgb(16, 185, 129)',
    cyan: 'rgb(6, 182, 212)',
    orange: 'rgb(249, 115, 22)',
    red: 'rgb(239, 68, 68)',
    yellow: 'rgb(234, 179, 8)',
    indigo: 'rgb(99, 102, 241)',
};

const iconMap: Record<string, any> = {
    publications: MessageSquare,
    chat: Zap,
    voip: Mic2,
    anonymous: Fingerprint,
    multimedia: Zap,
    support: LifeBuoy,
    notifications: Bell,
    security: Shield,
};

const mockupMap: Record<string, any> = {
    publications: Mockups.PublicationsMockup,
    chat: Mockups.ChatMockup,
    voip: Mockups.VoipMockup,
    anonymous: Mockups.AnonymousMockup,
    multimedia: Mockups.MultimediaMockup,
    support: Mockups.SupportMockup,
    notifications: Mockups.NotificationsMockup,
    security: Mockups.SecurityMockup,
};

export default function FeatureModal({ isOpen, onClose, featureKey, allFeatures, onNavigate }: FeatureModalProps) {
    const { t } = useLanguage();
    const currentIndex = allFeatures.findIndex(f => f.key === featureKey);
    const feature = allFeatures[currentIndex] || {};
    const Icon = iconMap[feature.key] || Zap;
    const Mockup = mockupMap[feature.key] || (() => <div className="flex items-center justify-center h-full text-slate-600 italic">Preview Coming Soon</div>);
    const featureColor = hexColorMap[feature.color] || hexColorMap.indigo;

    const next = () => onNavigate((currentIndex + 1) % allFeatures.length);
    const prev = () => onNavigate((currentIndex - 1 + allFeatures.length) % allFeatures.length);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 md:p-10 overflow-hidden">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl"
                    />

                    {/* Modal Container */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className={`relative w-full max-w-6xl h-full max-h-[90vh] bg-gradient-to-br ${gradientMap[feature.color] || gradientMap.blue} border border-white/10 rounded-[3rem] shadow-2xl overflow-hidden flex flex-col`}
                    >
                        {/* Header Controls */}
                        <div className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-6 md:px-10 md:py-8 border-b border-white/5 bg-slate-950/40 shrink-0">
                            <div className="flex items-center gap-2 sm:gap-6">
                                <button onClick={prev} className="p-2 sm:p-3 rounded-2xl hover:bg-white/5 transition-all text-slate-400 hover:text-white border border-white/5 active:scale-90">
                                    <ChevronLeft size={20} className="sm:w-6 sm:h-6" />
                                </button>
                                <span className="hidden sm:inline text-xs font-black text-slate-500 tracking-[0.3em] uppercase italic">
                                    {String(currentIndex + 1).padStart(2, '0')} — {String(allFeatures.length).padStart(2, '0')}
                                </span>
                                <button onClick={next} className="p-2 sm:p-3 rounded-2xl hover:bg-white/5 transition-all text-slate-400 hover:text-white border border-white/5 active:scale-90">
                                    <ChevronRight size={20} className="sm:w-6 sm:h-6" />
                                </button>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-3 px-3 py-2 sm:px-6 sm:py-2.5 rounded-2xl bg-white/5 border border-white/10 shadow-xl overflow-hidden max-w-[150px] sm:max-w-none">
                                <Icon size={16} className="sm:w-5 sm:h-5 shrink-0" style={{ color: featureColor }} />
                                <span className="text-xs sm:text-base font-black text-white tracking-tight italic uppercase truncate">{feature.title}</span>
                            </div>

                            <button onClick={onClose} className="p-2 sm:p-3 rounded-2xl hover:bg-red-500 transition-all text-slate-400 hover:text-white border border-white/5 group active:scale-90">
                                <X size={20} className="sm:w-6 sm:h-6 group-hover:rotate-90 transition-transform duration-300" />
                            </button>
                        </div>

                        {/* Main Content */}
                        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden custom-scrollbar">
                            {/* Left Side: Info */}
                            <div className="w-full md:w-5/12 p-6 sm:p-10 md:p-14 flex flex-col justify-center bg-slate-950/20 shrink-0">
                                <motion.div
                                    key={`${feature.key}-title`}
                                    initial={{ x: -30, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.1, duration: 0.6 }}
                                >
                                    <span className="font-black text-[10px] uppercase tracking-[0.3em] mb-4 md:mb-6 block italic" style={{ color: featureColor }}>
                                        Platform Core Architecture
                                    </span>
                                    <h2 className="text-3xl sm:text-4xl md:text-6xl font-black text-white mb-6 md:mb-8 leading-[1.1] tracking-tighter">
                                        {feature.title}
                                    </h2>
                                    <p className="text-lg md:text-xl text-slate-300/80 leading-relaxed mb-8 md:mb-10 font-medium italic">
                                        {feature.longDesc}
                                    </p>

                                    {/* Feature Detail list */}
                                    <div className="space-y-6">
                                        <div className="flex items-start gap-4 group">
                                            <div className="w-2 h-2 rounded-full mt-2 transition-transform group-hover:scale-150" style={{ backgroundColor: featureColor }} />
                                            <p className="text-sm font-bold text-slate-400 tracking-wide uppercase italic">Low-latency distributed infrastructure</p>
                                        </div>
                                        <div className="flex items-start gap-4 group">
                                            <div className="w-2 h-2 rounded-full mt-2 transition-transform group-hover:scale-150" style={{ backgroundColor: featureColor }} />
                                            <p className="text-sm font-bold text-slate-400 tracking-wide uppercase italic">End-to-end encrypted metadata</p>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>

                            {/* Right Side: Mockup */}
                            <div className="w-full md:w-7/12 p-10 flex items-center justify-center bg-slate-950/60 relative border-l border-white/5 overflow-x-auto md:overflow-hidden overflow-y-auto">
                                {/* Decorative background glow */}
                                <div className="absolute inset-0 opacity-30 pointer-events-none">
                                    <div
                                        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-[160px]"
                                        style={{ background: `radial-gradient(circle, ${featureColor}44 0%, transparent 70%)` }}
                                    />
                                </div>

                                <motion.div
                                    key={`${feature.key}-mockup`}
                                    initial={{ scale: 0.8, opacity: 0, rotateY: -10 }}
                                    animate={{ scale: 1, opacity: 1, rotateY: 0 }}
                                    exit={{ scale: 0.8, opacity: 0, rotateY: 10 }}
                                    transition={{ type: 'spring', damping: 25, stiffness: 100 }}
                                    className="w-full h-full min-h-[400px] md:min-h-0 relative z-10 flex items-center justify-center"
                                >
                                    <div className="w-full h-full min-h-[400px] max-w-[500px] max-h-[500px] bg-slate-900/40 rounded-[3rem] border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden ring-1 ring-white/5">
                                        <Mockup />
                                    </div>
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
