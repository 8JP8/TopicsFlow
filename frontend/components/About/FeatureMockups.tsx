import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageSquare, Users, Mic2, ShieldCheck, Fingerprint,
    LifeBuoy, Zap, Layout, Globe, Bell, Lock,
    ArrowBigUp, ArrowBigDown, MoreHorizontal, Send,
    Paperclip, Phone, Video, Volume2, MicOff, Search,
    Image as ImageIcon, Gift, Smile
} from 'lucide-react';
import { useState, useEffect } from 'react';

/**
 * Publications Mockup: High-fidelity Reddit-style post
 */
export const PublicationsMockup = () => (
    <div className="w-full h-full flex items-center justify-center p-6">
        <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-2xl relative overflow-hidden"
        >
            <div className="flex gap-4">
                {/* Vote Section - Matching app theme */}
                <div className="flex flex-col items-center gap-1 pt-1">
                    <motion.button whileTap={{ scale: 1.2 }} className="text-orange-500 hover:bg-orange-500/10 p-1 rounded">
                        <ArrowBigUp fill="currentColor" size={24} />
                    </motion.button>
                    <span className="text-sm font-bold text-slate-200">2.8k</span>
                    <motion.button whileTap={{ scale: 1.2 }} className="text-slate-600 hover:bg-blue-500/10 p-1 rounded">
                        <ArrowBigDown size={24} />
                    </motion.button>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white">T</div>
                        <span className="text-xs font-bold text-slate-300">t/technology</span>
                        <span className="text-[10px] text-slate-500">• 3h ago</span>
                    </div>
                    <div className="text-sm font-semibold text-slate-100 mb-2 truncate">The Future of Web3 in 2026</div>
                    <div className="space-y-1.5 mb-4">
                        <div className="h-2 w-full bg-slate-800 rounded" />
                        <div className="h-2 w-full bg-slate-800 rounded" />
                        <div className="h-2 w-2/3 bg-slate-800 rounded" />
                    </div>
                    <div className="flex gap-4 text-xs font-medium text-slate-500">
                        <div className="flex items-center gap-1.5 hover:bg-slate-800 p-1 -m-1 rounded transition-colors">
                            <MessageSquare size={14} /> 432
                        </div>
                        <div className="flex items-center gap-1.5 hover:bg-slate-800 p-1 -m-1 rounded transition-colors">
                            <Zap size={14} /> Award
                        </div>
                        <div className="flex items-center gap-1.5 hover:bg-slate-800 p-1 -m-1 rounded transition-colors">
                            <MoreHorizontal size={14} />
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    </div>
);

/**
 * Chat Mockup: High-fidelity messaging
 */
export const ChatMockup = () => {
    const [messages, setMessages] = useState([
        { id: 1, text: "Hey! Did you see the new update?", side: 'left', author: 'Alex' },
        { id: 2, text: "Yeah, the performance is insane! ⚡", side: 'right', author: 'Me' }
    ]);

    useEffect(() => {
        const interval = setInterval(() => {
            if (messages.length < 5) {
                setMessages(prev => [...prev, {
                    id: prev.length + 1,
                    text: prev.length === 2 ? "Check out the new group chats!" : "Already on it, let's go! 🔥",
                    side: prev.length % 2 === 0 ? 'right' : 'left',
                    author: prev.length % 2 === 0 ? 'Me' : 'Alex'
                }]);
            } else {
                setMessages([
                    { id: 1, text: "Hey! Did you see the new update?", side: 'left', author: 'Alex' },
                    { id: 2, text: "Yeah, the performance is insane! ⚡", side: 'right', author: 'Me' }
                ]);
            }
        }, 2500);
        return () => clearInterval(interval);
    }, [messages]);

    return (
        <div className="w-full h-full flex flex-col p-4 bg-slate-950/50">
            <div className="flex-1 space-y-4 overflow-hidden pt-2">
                <AnimatePresence>
                    {messages.map((m) => (
                        <motion.div
                            key={m.id}
                            initial={{ scale: 0.9, opacity: 0, x: m.side === 'right' ? 20 : -20 }}
                            animate={{ scale: 1, opacity: 1, x: 0 }}
                            className={`flex gap-2 ${m.side === 'right' ? 'flex-row-reverse' : ''}`}
                        >
                            <div className={`w-8 h-8 rounded-full flex-shrink-0 ${m.side === 'right' ? 'bg-purple-600' : 'bg-blue-600'} flex items-center justify-center text-[10px] font-bold text-white shadow-lg border border-white/10`}>
                                {m.author.charAt(0)}
                            </div>
                            <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-xs shadow-md border ${m.side === 'right'
                                ? 'bg-purple-600 border-purple-500 text-white rounded-tr-none'
                                : 'bg-slate-800 border-slate-700 text-slate-200 rounded-tl-none'
                                }`}>
                                <div className="font-bold text-[9px] mb-0.5 opacity-70">{m.author}</div>
                                {m.text}
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
            {/* Mock Input - Matching ChatInput.tsx style */}
            <div className="mt-4 bg-slate-900 border border-slate-700 rounded-2xl p-2 flex items-center gap-2 shadow-xl">
                <div className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"><Paperclip size={18} /></div>
                <div className="flex-1 text-[11px] text-slate-500 px-1 font-medium italic">Type a message...</div>
                <div className="flex items-center gap-1.5">
                    <div className="p-1 px-1.5 bg-slate-800 rounded text-[9px] font-black text-slate-500 border border-slate-700 hover:text-orange-400 hover:border-orange-400/50 transition-colors cursor-pointer tracking-widest">GIF</div>
                    <div className="p-1.5 text-slate-500 hover:text-yellow-400 transition-colors"><Smile size={18} /></div>
                    <div className="w-8 h-8 bg-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-purple-900/20 active:scale-95 transition-transform">
                        <Send size={14} />
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * VOIP Mockup: High-fidelity voice call
 */
export const VoipMockup = () => {
    return (
        <div className="w-full h-full flex flex-col p-4 bg-slate-950/50">
            {/* Redesigned VoIP: Chat Window Style */}
            <div className="flex-1 bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-2xl relative">
                {/* Header with Call Button */}
                <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white shadow-lg">G</div>
                        <div>
                            <div className="text-[10px] font-bold text-white">Group Chat</div>
                            <div className="text-[8px] text-slate-500 font-medium">3 members online</div>
                        </div>
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-950/20"
                    >
                        <Phone size={16} />
                    </motion.button>
                </div>

                {/* Chat Area Mock */}
                <div className="flex-1 p-4 space-y-3">
                    <div className="flex gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-800" />
                        <div className="bg-slate-800/50 h-3 w-2/3 rounded" />
                    </div>
                    <div className="flex gap-2 justify-end">
                        <div className="bg-blue-600/50 h-3 w-1/2 rounded" />
                    </div>
                </div>

                {/* In-Call Status Overlay (Bottom Left) */}
                <motion.div
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md border border-white/10 rounded-xl px-2.5 py-1.5 flex items-center gap-2 shadow-2xl z-20"
                >
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-black text-white uppercase tracking-widest">In Call</span>
                    <div className="flex gap-0.5 h-2 items-end">
                        {[1, 2, 3].map(b => (
                            <motion.div
                                key={b}
                                animate={{ height: [2, 6, 3, 8] }}
                                transition={{ repeat: Infinity, duration: 0.5 + b * 0.1 }}
                                className="w-0.5 bg-emerald-400 rounded-full"
                            />
                        ))}
                    </div>
                </motion.div>
            </div>

            {/* Controls Bar (Footer) */}
            <div className="mt-4 bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-2xl p-2.5 flex items-center justify-center gap-4 shadow-xl">
                <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400"><Mic2 size={18} /></div>
                <div className="w-11 h-11 bg-red-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-red-900/40 transform rotate-[135deg]">
                    <Phone size={20} />
                </div>
                <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center text-slate-400"><Volume2 size={18} /></div>
            </div>
        </div>
    );
};

/**
 * Anonymous Mockup: High-fidelity identity switching
 */
export const AnonymousMockup = () => {
    const [isAnon, setIsAnon] = useState(false);
    useEffect(() => {
        const interval = setInterval(() => setIsAnon(prev => !prev), 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full h-full flex flex-col items-center justify-center gap-8 p-6">
            <div className="relative group">
                <motion.div
                    animate={{
                        scale: isAnon ? 1.1 : 1,
                        boxShadow: isAnon ? "0 0 40px rgba(34, 211, 238, 0.3)" : "0 0 20px rgba(0,0,0,0.5)"
                    }}
                    className={`w-32 h-32 rounded-full border-4 ${isAnon ? 'border-cyan-500' : 'border-slate-700'} flex items-center justify-center bg-slate-900 overflow-hidden relative z-10 transition-colors duration-500`}
                >
                    <AnimatePresence mode="wait">
                        {isAnon ? (
                            <motion.div
                                key="anon"
                                initial={{ opacity: 0, rotateY: 180 }}
                                animate={{ opacity: 1, rotateY: 0 }}
                                exit={{ opacity: 0, rotateY: -180 }}
                                transition={{ type: "spring", damping: 15 }}
                                className="flex flex-col items-center"
                            >
                                <Fingerprint size={56} className="text-cyan-400" />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="user"
                                initial={{ opacity: 0, rotateY: -180 }}
                                animate={{ opacity: 1, rotateY: 0 }}
                                exit={{ opacity: 0, rotateY: 180 }}
                                transition={{ type: "spring", damping: 15 }}
                                className="flex flex-col items-center"
                            >
                                <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold text-white mb-1 shadow-lg shadow-blue-900/40">JV</div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
                {/* Decorative particles */}
                {isAnon && [1, 2, 3].map(i => (
                    <motion.div
                        key={i}
                        animate={{
                            y: [-20, -50],
                            x: [(i - 2) * 20, (i - 2) * 30],
                            opacity: [0, 1, 0]
                        }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        className="absolute top-0 left-12 w-1.5 h-1.5 bg-cyan-400 rounded-full"
                    />
                ))}
            </div>

            <div className="w-full max-w-[240px] bg-slate-900 border border-slate-700 rounded-2xl p-4 text-center shadow-xl">
                <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">Profile State</span>
                    <div className={`w-8 h-4 rounded-full relative transition-colors duration-500 ${isAnon ? 'bg-cyan-500' : 'bg-slate-700'}`}>
                        <motion.div
                            animate={{ x: isAnon ? 16 : 0 }}
                            className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow-sm"
                        />
                    </div>
                </div>
                <motion.div
                    layout
                    className="bg-slate-800/50 rounded-xl py-2 font-mono text-sm border border-slate-700/50"
                >
                    <motion.span animate={{ color: isAnon ? "#22d3ee" : "#3b82f6" }}>
                        {isAnon ? "Anon_Mask_7x" : "JoaoVasco"}
                    </motion.span>
                </motion.div>
                <div className="text-[9px] text-slate-500 mt-3 italic font-medium">
                    {isAnon ? "Public metrics & bio encrypted" : "Authentic profile data broadcasting"}
                </div>
            </div>
        </div>
    );
};

/**
 * Security Mockup: High-fidelity 2FA Security
 */
export const SecurityMockup = () => {
    return (
        <div className="w-full h-full flex items-center justify-center p-6">
            <div className="w-full max-w-[280px] bg-slate-900 border border-slate-700 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
                {/* Visual Flair */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-50" />
                <motion.div
                    animate={{ scale: [1, 1.1, 1], opacity: [0.1, 0.2, 0.1] }}
                    transition={{ duration: 4, repeat: Infinity }}
                    className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500 rounded-full blur-[60px]"
                />

                <div className="text-center relative z-10">
                    <div className="mb-6 inline-flex p-4 bg-indigo-500/10 rounded-3xl border border-indigo-500/20 relative">
                        <ShieldCheck size={48} className="text-indigo-400" />
                        <motion.div
                            animate={{ scale: [1, 1.2, 1], opacity: [0, 1, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 border-2 border-indigo-500 rounded-3xl"
                        />
                    </div>
                    <div className="text-xs font-bold text-slate-200 mb-2 uppercase tracking-widest italic">Verification Required</div>
                    <div className="text-[10px] text-slate-500 mb-6">Enter the code from your authenticator app.</div>

                    {/* 2FA Input Style */}
                    <div className="flex gap-2 justify-center mb-8">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <motion.div
                                key={i}
                                animate={{
                                    borderColor: i <= 3 ? "#818cf8" : "#334155",
                                    scale: i === 4 ? [1, 1.05, 1] : 1
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className={`w-8 h-12 border-2 rounded-xl flex items-center justify-center font-mono font-black text-lg ${i <= 3 ? 'text-indigo-400 bg-indigo-500/5' : 'text-slate-600 bg-slate-950'}`}
                            >
                                {i <= 3 ? Math.floor(Math.random() * 9) : ""}
                                {i === 4 && <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-0.5 h-6 bg-indigo-500 rounded-full" />}
                            </motion.div>
                        ))}
                    </div>

                    <motion.button
                        whileHover={{ scale: 1.02, backgroundColor: '#4f46e5' }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full bg-indigo-600 py-3 rounded-2xl text-xs font-black text-white shadow-xl shadow-indigo-950/20 flex items-center justify-center gap-2 group"
                    >
                        <Lock size={14} className="group-hover:translate-y-[-1px] transition-transform" />
                        Authorize Session
                    </motion.button>
                </div>
            </div>
        </div>
    );
};

/**
 * Support Mockup: High-fidelity Ticket System
 */
export const SupportMockup = () => {
    const statuses = ['Pending', 'Open', 'Resolved'];
    const [step, setStep] = useState(0);
    useEffect(() => {
        const interval = setInterval(() => setStep(prev => (prev + 1) % 3), 3000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full h-full flex flex-col p-5 bg-slate-950/50">
            <div className="flex items-center justify-between mb-6">
                <div className="text-xs font-bold text-slate-300">Support Center</div>
                <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-slate-700" />
                    <div className="w-2 h-2 rounded-full bg-slate-700" />
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-xl mb-4">
                <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                        <div className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Ticket #CH-9942</div>
                        <div className="text-xs font-bold text-slate-100">Performance issue on mobile</div>
                    </div>
                    <motion.div
                        animate={{
                            backgroundColor: step === 2 ? 'rgba(16, 185, 129, 0.1)' : step === 1 ? 'rgba(59, 130, 246, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: step === 2 ? '#10b981' : step === 1 ? '#3b82f6' : '#ef4444',
                            borderColor: step === 2 ? 'rgba(16, 185, 129, 0.3)' : step === 1 ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)'
                        }}
                        className="px-2 py-0.5 rounded-lg text-[9px] font-black border uppercase italic transition-colors duration-500"
                    >
                        {statuses[step]}
                    </motion.div>
                </div>
                <div className="space-y-1.5 mb-5 opacity-40">
                    <div className="h-1.5 w-full bg-slate-600 rounded" />
                    <div className="h-1.5 w-4/5 bg-slate-600 rounded" />
                </div>

                {/* Agent Reply */}
                <motion.div
                    initial={false}
                    animate={{ opacity: step >= 1 ? 1 : 0, y: step >= 1 ? 0 : 10 }}
                    className="flex gap-2.5 pt-4 border-t border-slate-800"
                >
                    <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-[10px] font-bold text-white shadow-lg border border-red-500/20">A</div>
                    <div className="flex-1 bg-slate-800/80 rounded-2xl p-2.5 border border-slate-700/50">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-bold text-red-400 italic">Support Lead</span>
                            <span className="text-[8px] text-slate-500">2 min ago</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-600/50 rounded" />
                    </div>
                </motion.div>
            </div>

            <div className="flex-1 bg-red-600/5 border border-red-500/20 rounded-2xl border-dashed flex items-center justify-center group hover:bg-red-600/10 transition-colors cursor-pointer">
                <div className="flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-widest">
                    <LifeBuoy size={16} className="group-hover:rotate-45 transition-transform" />
                    New Request
                </div>
            </div>
        </div>
    );
};

/**
 * Notifications Mockup: High-fidelity Alert Center
 */
export const NotificationsMockup = () => {
    return (
        <div className="w-full h-full flex items-center justify-center relative p-6 bg-slate-950/50">
            <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                <Bell size={200} className="text-yellow-500" />
            </div>

            <div className="w-full max-w-[300px] flex flex-col gap-3 relative z-10 font-bold italic">
                {[1, 2, 3].map((i) => (
                    <motion.div
                        key={i}
                        initial={{ x: 50, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: i * 0.2, duration: 0.5 }}
                        className="bg-slate-900 border border-slate-700 rounded-2xl p-3 shadow-2xl flex items-center gap-3 relative group overflow-hidden"
                    >
                        <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500" />
                        <div className={`w-10 h-10 rounded-xl flex-shrink-0 ${i === 1 ? 'bg-purple-600' : i === 2 ? 'bg-blue-600' : 'bg-emerald-600'} flex items-center justify-center relative`}>
                            {i === 1 ? <MessageSquare size={20} className="text-white" /> : i === 2 ? <Users size={20} className="text-white" /> : <Phone size={20} className="text-white" />}
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 border-2 border-slate-900 rounded-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] text-slate-200 mb-0.5 line-clamp-1">
                                {i === 1 ? "New direct message from @Alex" : i === 2 ? "Invitation to t/web_design" : "Missed call: Group Room 04"}
                            </div>
                            <div className="text-[8px] text-slate-500 font-black tracking-widest uppercase">
                                Just Now • Urgent
                            </div>
                        </div>
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            className="w-7 h-7 bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 hover:text-white transition-colors border border-slate-700"
                        >
                            <Bell size={14} />
                        </motion.button>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

/**
 * Multimedia Mockup: High-fidelity Content Discovery
 */
export const MultimediaMockup = () => {
    return (
        <div className="w-full h-full flex flex-col p-4 bg-slate-950/50">
            {/* Search Bar - Matching GIF picker style */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 flex items-center gap-2 mb-4 shadow-lg border-b-2 border-b-orange-500/30">
                <Search size={14} className="text-slate-500" />
                <div className="flex-1 text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">Search GIFs on Tenor...</div>
                <div className="h-4 w-[1px] bg-slate-700 mx-1" />
                <ImageIcon size={14} className="text-orange-500" />
            </div>

            <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3">
                <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 relative group shadow-lg"
                >
                    <div className="absolute inset-0 bg-gradient-to-t from-orange-600/20 to-transparent" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 8, ease: "linear" }}>
                            <Globe size={40} className="text-orange-500/10" />
                        </motion.div>
                    </div>
                    <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-black text-white border border-white/10 uppercase italic">
                        GIF
                    </div>
                </motion.div>
                <div className="grid grid-rows-2 gap-3">
                    <motion.div whileHover={{ scale: 1.05 }} className="bg-orange-600 rounded-2xl border border-orange-400 animate-pulse flex items-center justify-center shadow-lg shadow-orange-950/20 font-black text-[9px] italic tracking-tighter text-white">
                        HD MEDIA
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }} className="bg-slate-800 rounded-2xl border border-slate-700 flex items-center justify-center shadow-lg group">
                        <Gift size={24} className="text-orange-500/40 group-hover:scale-110 transition-transform" />
                    </motion.div>
                </div>
                <motion.div whileHover={{ scale: 1.05 }} className="bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 flex items-center justify-center p-4 relative shadow-lg">
                    <div className="absolute inset-0 flex items-center justify-center opacity-5">
                        <ImageIcon size={80} className="text-white" />
                    </div>
                    <div className="w-full h-full border-2 border-dashed border-orange-500/20 rounded-xl flex items-center justify-center">
                        <Paperclip size={20} className="text-orange-400 animate-bounce" />
                    </div>
                </motion.div>
                <motion.div
                    whileHover={{ scale: 1.05 }}
                    className="bg-slate-900 rounded-2xl border border-orange-500/30 flex flex-col items-center justify-center p-3 shadow-lg relative overflow-hidden"
                >
                    <div className="absolute top-0 right-0 w-8 h-8 bg-orange-500/10 rotate-45 translate-x-4 -translate-y-4" />
                    <Zap size={28} className="text-orange-500 mb-1" />
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest text-center">Fast Transfer</div>
                </motion.div>
            </div>
        </div>
    );
};
