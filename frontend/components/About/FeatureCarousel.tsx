import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, useAnimation, useMotionValue, AnimatePresence, animate, useSpring } from 'framer-motion';
import { ChevronLeft, ChevronRight, MessageSquare, Mic2, Fingerprint, LifeBuoy, Zap, Bell, Shield, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import FeatureModal from './FeatureModal';

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

const colorMap: Record<string, string> = {
    blue: 'rgb(59, 130, 246)',
    purple: 'rgb(168, 85, 247)',
    emerald: 'rgb(16, 185, 129)',
    cyan: 'rgb(6, 182, 212)',
    orange: 'rgb(249, 115, 22)',
    red: 'rgb(239, 68, 68)',
    yellow: 'rgb(234, 179, 8)',
    indigo: 'rgb(99, 102, 241)',
};

export default function FeatureCarousel() {
    const { t, language } = useLanguage();
    const [isPaused, setIsPaused] = useState(false);
    const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
    const [hoveredCard, setHoveredCard] = useState<number | null>(null);
    const [centeredIndex, setCenteredIndex] = useState<number | null>(null);
    const [isSnapping, setIsSnapping] = useState(false);

    // Feature keys in order
    const featureKeys = ['publications', 'chat', 'voip', 'anonymous', 'multimedia', 'support', 'notifications', 'security'];

    // Map data for usage
    const features = useMemo(() => featureKeys.map(key => ({
        key,
        title: t(`about.carousel.extended.${key}.title`),
        shortDesc: t(`about.carousel.extended.${key}.shortDesc`),
        longDesc: t(`about.carousel.extended.${key}.longDesc`),
        color: t(`about.carousel.extended.${key}.color`),
    })), [language, t]);

    // Infinite loop trick: Triple the array
    const loopedFeatures = [...features, ...features, ...features];

    const xRaw = useMotionValue(0);
    // Removed useSpring to avoid rewind animation on wrap-around
    // const x = useSpring(xRaw, { damping: 45, stiffness: 350 });

    const containerRef = useRef<HTMLDivElement>(null);
    const parentRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef<number>();
    const lastTimestampRef = useRef<number>();

    // Constants for layout
    const cardWidth = 300;
    const gapSize = 40;
    const itemWidth = cardWidth + gapSize;
    const speed = 64; // Pixels per second
    const totalSetWidth = features.length * itemWidth;

    // Reset loop point logic
    const wrapAround = useCallback((val: number) => {
        if (val <= -totalSetWidth) return val + totalSetWidth;
        if (val >= 0) return val - totalSetWidth;
        return val;
    }, [totalSetWidth]);

    // Animation Loop
    useEffect(() => {
        const animateLoop = (timestamp: number) => {
            if (!lastTimestampRef.current) lastTimestampRef.current = timestamp;
            const deltaTime = timestamp - lastTimestampRef.current;
            lastTimestampRef.current = timestamp;

            if (!isPaused && !selectedFeature && !isSnapping) {
                const currentX = xRaw.get();
                const nextX = currentX - (speed * deltaTime) / 1000;
                xRaw.set(wrapAround(nextX));
            }
            requestRef.current = requestAnimationFrame(animateLoop);
        };

        requestRef.current = requestAnimationFrame(animateLoop);
        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [isPaused, selectedFeature, isSnapping, wrapAround, xRaw]);

    // Snapping Logic - Precision Centering
    const snapToNearest = useCallback(() => {
        setIsSnapping(true);
        const currentX = xRaw.get();
        // Use container width for better precision
        const viewportWidth = containerRef.current?.getBoundingClientRect().width || window.innerWidth;
        const center = viewportWidth / 2;

        // Target is mathematically the center of the viewport minus half the card width
        const bestIndex = Math.round((center - currentX - (cardWidth / 2)) / itemWidth);
        const targetX = center - (bestIndex * itemWidth) - (cardWidth / 2);

        setCenteredIndex(bestIndex);

        animate(xRaw, targetX, {
            type: "spring",
            damping: 35,
            stiffness: 300,
            onComplete: () => setIsSnapping(false)
        });
    }, [xRaw, itemWidth, cardWidth]);

    const handleManualMove = useCallback((direction: 'left' | 'right') => {
        setIsSnapping(true);
        const currentX = xRaw.get();
        const viewportWidth = containerRef.current?.getBoundingClientRect().width || window.innerWidth;
        const center = viewportWidth / 2;

        const currentIndex = Math.round((center - currentX - (cardWidth / 2)) / itemWidth);
        const nextIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
        const targetX = center - (nextIndex * itemWidth) - (cardWidth / 2);

        setCenteredIndex(nextIndex);
        animate(xRaw, targetX, {
            type: "spring",
            damping: 30,
            stiffness: 250,
            onComplete: () => setIsSnapping(false)
        });
    }, [xRaw, itemWidth, cardWidth]);

    const handleMouseEnterParent = useCallback(() => {
        setIsPaused(true);
        snapToNearest();
    }, [snapToNearest]);

    const handleMouseLeaveParent = useCallback(() => {
        setIsPaused(false);
        setCenteredIndex(null);
        lastTimestampRef.current = undefined;
    }, []);

    return (
        <div className="relative w-full py-12 px-4 select-none flex flex-col items-center">
            {/* Ambient Background Glows */}
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[150px] pointer-events-none" />
            <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-[150px] pointer-events-none" />

            {/* Main Carousel Container - Width aligned with Readme (6xl), Rounded, Translucent */}
            <div
                ref={parentRef}
                onMouseEnter={handleMouseEnterParent}
                onMouseLeave={handleMouseLeaveParent}
                className="relative w-full max-w-6xl bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-[3rem] md:rounded-[4rem] overflow-hidden shadow-2xl"
            >

                {/* Internal Slider Wrapper */}
                <div
                    ref={containerRef}
                    className="relative z-10 py-16 md:py-20 px-4 overflow-visible"
                >
                    <motion.div
                        style={{ x: xRaw }}
                        className="flex gap-4 md:gap-10 items-center will-change-transform"
                    >
                        {loopedFeatures.map((feature, idx) => {
                            const Icon = iconMap[feature.key] || Zap;
                            const isHovered = hoveredCard === idx;
                            const isCentered = centeredIndex === idx;
                            const featureColor = colorMap[feature.color] || colorMap.indigo;

                            // Dynamic spatial offset logic - Symmetric gaps
                            let spatialOffset = 0;
                            const gapExpansion = 100; // Symmetrical gap for buttons
                            if (centeredIndex !== null) {
                                if (idx < centeredIndex) spatialOffset = -gapExpansion;
                                if (idx > centeredIndex) spatialOffset = gapExpansion;
                            }

                            return (
                                <motion.div
                                    key={`${feature.key}-${idx}`}
                                    animate={{
                                        x: isPaused ? spatialOffset : 0,
                                        scale: isCentered ? 1.05 : isPaused ? 0.9 : 1,
                                        opacity: isCentered || !isPaused ? 1 : 0.35,
                                    }}
                                    transition={{ type: "spring", stiffness: 350, damping: 35 }}
                                    onMouseEnter={() => setHoveredCard(idx)}
                                    onMouseLeave={() => setHoveredCard(null)}
                                    whileHover={{
                                        scale: isCentered ? 1.05 : 0.98,
                                        transition: { type: "spring", stiffness: 400, damping: 25 }
                                    }}
                                    onClick={() => setSelectedFeature(feature.key)}
                                    className={`relative w-[260px] md:w-[300px] h-[440px] shrink-0 rounded-[3rem] p-8 md:p-10 overflow-hidden cursor-pointer bg-slate-950/40 border transition-all duration-300 ${isHovered
                                        ? 'border-blue-500/50 ring-4 ring-blue-500/10'
                                        : 'border-white/5 shadow-xl'
                                        }`}
                                    style={{
                                        boxShadow: isHovered ? `0 20px 40px -10px ${featureColor}33` : 'none',
                                    }}
                                >
                                    {/* Icon Layer */}
                                    <div
                                        className={`w-16 h-16 rounded-2xl mb-8 flex items-center justify-center transition-all duration-300 relative z-10 border border-white/5 ${isHovered ? 'rotate-6 scale-110' : 'rotate-0'
                                            }`}
                                        style={{
                                            backgroundColor: isHovered ? `${featureColor}22` : 'rgba(255,255,255,0.03)',
                                            borderColor: isHovered ? `${featureColor}44` : 'rgba(255,255,255,0.05)'
                                        }}
                                    >
                                        <Icon
                                            size={32}
                                            className="transition-colors duration-300"
                                            style={{ color: isHovered ? featureColor : 'rgba(148, 163, 184, 0.6)' }}
                                        />
                                    </div>

                                    {/* Content */}
                                    <div className="relative z-10">
                                        <h3 className="text-2xl font-black text-white mb-4 leading-tight tracking-tight">
                                            {feature.title}
                                        </h3>
                                        <p className="text-slate-400 text-sm leading-relaxed mb-10 line-clamp-4 font-medium italic opacity-80">
                                            {feature.shortDesc}
                                        </p>
                                    </div>

                                    {/* Footer Action */}
                                    <div className="absolute bottom-10 left-10 right-10 flex items-center justify-between border-t border-white/5 pt-6">
                                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
                                            System Module
                                        </span>
                                        <motion.div
                                            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all bg-white/5 text-slate-400"
                                            style={{
                                                backgroundColor: isHovered ? featureColor : 'rgba(255,255,255,0.05)',
                                                color: isHovered ? '#fff' : 'rgba(148,163,184,0.6)'
                                            }}
                                        >
                                            <ArrowRight size={16} />
                                        </motion.div>
                                    </div>

                                    {/* Glow Overlay */}
                                    <div
                                        className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none"
                                        style={{ background: `radial-gradient(circle at 50% 100%, ${featureColor}, transparent)` }}
                                    />
                                </motion.div>
                            );
                        })}
                    </motion.div>
                </div>

                {/* Navigation Arrows - Symmetrical & Stable inside parent container */}
                <AnimatePresence>
                    {isPaused && !selectedFeature && (
                        <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
                            <div className="relative w-[300px] h-[440px]">
                                <motion.button
                                    initial={{ opacity: 0, scale: 0.8, x: -20 }}
                                    animate={{ opacity: 1, scale: 1, x: -85 }}
                                    exit={{ opacity: 0, scale: 0.8, x: -20 }}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleManualMove('left');
                                    }}
                                    className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-full w-12 h-12 rounded-xl bg-slate-900 border border-white/20 flex items-center justify-center text-white/50 hover:text-white hover:bg-blue-600 hover:border-blue-400 transition-all shadow-xl pointer-events-auto active:scale-90"
                                >
                                    <ChevronLeft size={28} />
                                </motion.button>

                                <motion.button
                                    initial={{ opacity: 0, scale: 0.8, x: 20 }}
                                    animate={{ opacity: 1, scale: 1, x: 85 }}
                                    exit={{ opacity: 0, scale: 0.8, x: 20 }}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleManualMove('right');
                                    }}
                                    className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-full w-12 h-12 rounded-xl bg-slate-900 border border-white/20 flex items-center justify-center text-white/50 hover:text-white hover:bg-blue-600 hover:border-blue-400 transition-all shadow-xl pointer-events-auto active:scale-90"
                                >
                                    <ChevronRight size={28} />
                                </motion.button>
                            </div>
                        </div>
                    )}
                </AnimatePresence>
            </div>

            {/* Feature Detailed Modal */}
            <FeatureModal
                isOpen={!!selectedFeature}
                onClose={() => setSelectedFeature(null)}
                featureKey={selectedFeature || ''}
                allFeatures={features}
                onNavigate={(idx) => setSelectedFeature(features[idx].key)}
            />
        </div>
    );
}
