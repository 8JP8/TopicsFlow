import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, useAnimation, useMotionValue, AnimatePresence, animate, useSpring } from 'framer-motion';
import { ChevronLeft, ChevronRight, MessageSquare, Mic2, Fingerprint, LifeBuoy, Zap, Bell, Shield, ArrowRight, Search, Gavel, UserCircle, Palette } from 'lucide-react';
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
    discovery: Search,
    moderation: Gavel,
    profiles: UserCircle,
    customization: Palette,
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
    const [isDragging, setIsDragging] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Feature keys in order
    const featureKeys = ['publications', 'chat', 'voip', 'anonymous', 'multimedia', 'support', 'notifications', 'security', 'discovery', 'moderation', 'profiles', 'customization'];

    // Map data for usage
    const features = useMemo(() => featureKeys.map(key => ({
        key,
        title: t(`about.carousel.extended.${key}.title`),
        shortDesc: t(`about.carousel.extended.${key}.shortDesc`),
        longDesc: t(`about.carousel.extended.${key}.longDesc`),
        color: t(`about.carousel.extended.${key}.color`),
        subtitle: t(`about.carousel.extended.${key}.subtitle`),
        bullet1: t(`about.carousel.extended.${key}.bullet1`),
        bullet2: t(`about.carousel.extended.${key}.bullet2`),
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
    const timerRef = useRef<NodeJS.Timeout>();
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Refs for Loop State to avoid Re-renders/Effect teardown
    const isPausedRef = useRef(false);
    const isSnappingRef = useRef(false);
    const isDraggingRef = useRef(false);
    const selectedFeatureRef = useRef<string | null>(null);

    // Sync Refs
    useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
    useEffect(() => { isSnappingRef.current = isSnapping; }, [isSnapping]);
    useEffect(() => { isDraggingRef.current = isDragging; }, [isDragging]);
    useEffect(() => { selectedFeatureRef.current = selectedFeature; }, [selectedFeature]);

    // Mobile detection
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Constants for layout
    const cardWidth = isMobile ? 280 : 300;
    const gapSize = isMobile ? 12 : 40;
    const itemWidth = cardWidth + gapSize;
    const speed = 64; // Pixels per second
    const totalSetWidth = features.length * itemWidth;

    // Reset loop point logic - Keep x between -2*totalSetWidth and -totalSetWidth
    const wrapAround = useCallback((val: number) => {
        const minX = -totalSetWidth * 2;
        const maxX = -totalSetWidth;
        if (val <= minX) return val + totalSetWidth;
        if (val >= maxX) return val - totalSetWidth;
        return val;
    }, [totalSetWidth]);

    // Snapping Logic - Precision Centering
    const snapToIndex = useCallback((index: number) => {
        if (!containerRef.current) return;
        setIsSnapping(true);
        const viewportWidth = containerRef.current.offsetWidth;
        const center = viewportWidth / 2;

        const targetX = center - (index * itemWidth) - (cardWidth / 2);

        setCenteredIndex(index);

        animate(xRaw, targetX, {
            type: "spring",
            stiffness: 300,
            damping: 30,
            mass: 1,
            onComplete: () => {
                const finalX = xRaw.get();
                const wrappedX = wrapAround(finalX);
                if (Math.abs(wrappedX - finalX) > 1) { // Only reset if difference is significant
                    xRaw.set(wrappedX);
                    const newIndex = Math.round((center - wrappedX - (cardWidth / 2)) / itemWidth);
                    setCenteredIndex(newIndex);
                }
                setIsSnapping(false);
            }
        });
    }, [xRaw, itemWidth, cardWidth, wrapAround]);

    const snapToNearest = useCallback(() => {
        if (!containerRef.current) return;
        const currentX = xRaw.get();
        const viewportWidth = containerRef.current.offsetWidth;
        const center = viewportWidth / 2;
        const bestIndex = Math.round((center - currentX - (cardWidth / 2)) / itemWidth);
        snapToIndex(bestIndex);
    }, [xRaw, itemWidth, cardWidth, snapToIndex]);

    const handleManualMove = useCallback((direction: 'left' | 'right') => {
        if (!containerRef.current) return;
        const currentX = xRaw.get();
        const viewportWidth = containerRef.current.offsetWidth;
        const center = viewportWidth / 2;

        // Base the next move on the current visual position to ensure accuracy
        const currentIdx = Math.round((center - currentX - (cardWidth / 2)) / itemWidth);
        const nextIndex = direction === 'left' ? currentIdx - 1 : currentIdx + 1;
        snapToIndex(nextIndex);
    }, [xRaw, itemWidth, cardWidth, snapToIndex]);

    // Animation Loop (Desktop Only)
    // Animation Loop (Desktop Only) - Optimized with Refs
    useEffect(() => {
        if (isMobile) return;

        const animateLoop = (timestamp: number) => {
            if (!lastTimestampRef.current) lastTimestampRef.current = timestamp;
            const deltaTime = timestamp - lastTimestampRef.current;
            lastTimestampRef.current = timestamp;

            // Read directly from refs to avoid effect dependencies
            if (!isPausedRef.current && !selectedFeatureRef.current && !isSnappingRef.current && !isDraggingRef.current) {
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
        // Dependencies are minimal: only re-run if mobile state or structural layout changes
    }, [isMobile, wrapAround, xRaw]);

    // Auto-timer for Mobile
    useEffect(() => {
        if (!isMobile || selectedFeature) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        timerRef.current = setInterval(() => {
            if (!isDragging && !isSnapping) {
                handleManualMove('right');
            }
        }, 4000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isMobile, selectedFeature, isDragging, isSnapping, handleManualMove]);

    // Initial center for mobile
    useEffect(() => {
        const setInitialCenter = () => {
            if (isMobile && containerRef.current) {
                const viewportWidth = containerRef.current.offsetWidth;
                const center = viewportWidth / 2;
                // Place the first real card (after the first buffer set) in the center
                const currInitialX = center - (features.length * itemWidth) - (cardWidth / 2);
                xRaw.set(currInitialX);
                setCenteredIndex(features.length);
            }
        };

        // Run after a short delay to ensure layout is ready
        const timer = setTimeout(setInitialCenter, 100);
        return () => clearTimeout(timer);
    }, [isMobile, features.length, itemWidth, cardWidth, xRaw]);

    const handleMouseEnterParent = useCallback(() => {
        if (isMobile) return;
        setIsPaused(true);
        snapToNearest();
    }, [isMobile, snapToNearest]);

    const handleMouseLeaveParent = useCallback(() => {
        if (isMobile) return;
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
        setIsPaused(false);
        setCenteredIndex(null);
        setHoveredCard(null);
        lastTimestampRef.current = undefined;
    }, [isMobile]);

    return (
        <div className="relative w-full py-12 px-2 md:px-4 select-none flex flex-col items-center">
            {/* Ambient Background Glows */}
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-blue-500/5 rounded-full blur-[100px] md:blur-[150px] pointer-events-none" />
            <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[300px] md:w-[600px] h-[300px] md:h-[600px] bg-purple-500/5 rounded-full blur-[100px] md:blur-[150px] pointer-events-none" />

            {/* Main Carousel Container - Width aligned with Readme (6xl), Rounded, Translucent */}
            <div
                ref={parentRef}
                onMouseEnter={handleMouseEnterParent}
                onMouseLeave={handleMouseLeaveParent}
                className="relative w-full max-w-6xl bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-[3rem] md:rounded-[4rem] overflow-hidden shadow-2xl"
            >

                {/* Internal Slider Wrapper - Removed horizontal padding to fix centering precision */}
                <div
                    ref={containerRef}
                    className="relative z-10 py-10 md:py-20 overflow-visible"
                >
                    <motion.div
                        style={{ x: xRaw }}
                        className="flex gap-3 md:gap-10 items-center will-change-transform cursor-grab active:cursor-grabbing"
                        drag="x"
                        dragConstraints={{ left: -totalSetWidth * 2.5, right: -totalSetWidth * 0.5 }}
                        onDragStart={() => {
                            setIsDragging(true);
                            if (!isMobile) setIsPaused(true);
                        }}
                        onDragEnd={() => {
                            setIsDragging(false);
                            snapToNearest();
                        }}
                    >
                        {loopedFeatures.map((feature, idx) => {
                            const Icon = iconMap[feature.key] || Zap;
                            const isHovered = hoveredCard === idx;
                            const isCentered = centeredIndex === idx || (isMobile && centeredIndex === null && idx === features.length);
                            const featureColor = colorMap[feature.color] || colorMap.indigo;

                            // Dynamic spatial offset logic - Symmetric gaps
                            let spatialOffset = 0;
                            const gapExpansion = isMobile ? 0 : 100; // No gap expansion on mobile
                            if (centeredIndex !== null && !isMobile) {
                                if (idx < centeredIndex) spatialOffset = -gapExpansion;
                                if (idx > centeredIndex) spatialOffset = gapExpansion;
                            }

                            return (
                                <motion.div
                                    key={`${feature.key}-${idx}`}
                                    animate={{
                                        x: (isPaused || isMobile) ? spatialOffset : 0,
                                        scale: isCentered ? (isMobile ? 1.0 : 1.05) : (isPaused || isMobile ? 0.92 : 1),
                                        opacity: isCentered || (!isPaused && !isMobile) ? 1 : (isMobile ? 0.8 : 0.35),
                                    }}
                                    transition={{
                                        type: "tween",
                                        ease: "easeOut",
                                        duration: 0.4
                                    }}
                                    onMouseEnter={() => {
                                        if (!isMobile) {
                                            setHoveredCard(idx);
                                            // Debounce slightly to prevent erratic behavior, but keep it snappy
                                            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                            hoverTimeoutRef.current = setTimeout(() => {
                                                if (!isDragging) {
                                                    snapToIndex(idx);
                                                }
                                            }, 50); // Reduced from 150ms to 50ms for faster response
                                        }
                                    }}
                                    onMouseLeave={() => {
                                        if (!isMobile) {
                                            setHoveredCard(null);
                                            if (hoverTimeoutRef.current) {
                                                clearTimeout(hoverTimeoutRef.current);
                                                hoverTimeoutRef.current = null;
                                            }
                                        }
                                    }}
                                    whileHover={{
                                        scale: isMobile ? 1.0 : (isCentered ? 1.05 : 0.98),
                                        transition: { type: "spring", stiffness: 400, damping: 25 }
                                    }}
                                    onClick={() => setSelectedFeature(feature.key)}
                                    className={`relative shrink-0 rounded-[2.5rem] md:rounded-[3rem] p-6 md:p-10 overflow-hidden cursor-pointer bg-slate-950/40 border transition-all duration-300 ${isHovered || (isMobile && isCentered)
                                        ? 'ring-4'
                                        : 'shadow-xl'
                                        }`}
                                    style={{
                                        width: cardWidth,
                                        height: isMobile ? 380 : 440,
                                        backgroundColor: (isHovered || isMobile) ? `${featureColor}08` : 'rgba(30, 41, 59, 0.4)', // More solid, no blur
                                        borderColor: (isHovered || isMobile) ? `${featureColor}99` : 'rgba(255,255,255,0.05)',
                                        boxShadow: (isHovered || isMobile) ? `0 25px 50px -12px ${featureColor}55` : 'none',
                                        ['--tw-ring-color' as any]: (isHovered || (isMobile && isCentered)) ? `${featureColor}44` : 'transparent',
                                    }}
                                >
                                    {/* Icon Layer */}
                                    <div
                                        className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl mb-6 md:mb-8 flex items-center justify-center transition-all duration-300 relative z-10 border border-white/5 ${(isHovered || isMobile) ? 'rotate-6 scale-110' : 'rotate-0'
                                            }`}
                                        style={{
                                            backgroundColor: (isHovered || isMobile) ? `${featureColor}22` : 'rgba(255,255,255,0.03)',
                                            borderColor: (isHovered || isMobile) ? `${featureColor}44` : 'rgba(255,255,255,0.05)'
                                        }}
                                    >
                                        <Icon
                                            size={isMobile ? 28 : 32}
                                            className="transition-colors duration-300"
                                            style={{ color: (isHovered || isMobile) ? featureColor : 'rgba(148, 163, 184, 0.6)' }}
                                        />
                                    </div>

                                    {/* Content */}
                                    <div className="relative z-10">
                                        <h3 className="text-xl md:text-2xl font-black text-white mb-3 md:mb-4 leading-tight tracking-tight">
                                            {feature.title}
                                        </h3>
                                        <p className="text-slate-400 text-xs md:text-sm leading-relaxed mb-8 md:mb-10 line-clamp-4 font-medium italic opacity-80">
                                            {feature.shortDesc}
                                        </p>
                                    </div>

                                    {/* Footer Action */}
                                    <div className="absolute bottom-8 md:bottom-10 left-8 md:left-10 right-8 md:right-10 flex items-center justify-between border-t border-white/5 pt-4 md:pt-6">
                                        <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 italic">
                                            System Module
                                        </span>
                                        <motion.div
                                            className="w-7 h-7 md:w-8 md:h-8 rounded-lg md:rounded-xl flex items-center justify-center transition-all bg-white/5 text-slate-400"
                                            style={{
                                                backgroundColor: (isHovered || isMobile) ? featureColor : 'rgba(255,255,255,0.05)',
                                                color: (isHovered || isMobile) ? '#fff' : 'rgba(148,163,184,0.6)'
                                            }}
                                        >
                                            <ArrowRight size={isMobile ? 14 : 16} />
                                        </motion.div>
                                    </div>

                                    {/* Simplified Glow Overlay */}
                                    <div
                                        className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-700 pointer-events-none"
                                        style={{
                                            background: isHovered ? `radial-gradient(circle at 50% 100%, ${featureColor}, transparent)` : 'none'
                                        }}
                                    />
                                </motion.div>
                            );
                        })}
                    </motion.div>
                </div>

                {/* Navigation Arrows - Optimized visibility without unmounting */}
                <motion.div
                    className="absolute inset-0 pointer-events-none z-50 flex items-center justify-between px-4 md:justify-center md:px-0"
                    animate={{
                        opacity: (isPaused || isMobile) && !selectedFeature ? 1 : 0
                    }}
                    transition={{ duration: 0.3 }}
                >
                    <div className={`relative ${isMobile ? 'flex w-full justify-between items-center h-full' : 'w-[450px] h-[440px]'}`}>
                        <motion.button
                            initial={{ scale: 0.8 }}
                            animate={{
                                scale: (isPaused || isMobile) ? 1 : 0.8,
                                x: isMobile ? 0 : -85,
                                pointerEvents: (isPaused || isMobile) && !selectedFeature ? 'auto' : 'none'
                            }}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleManualMove('left');
                            }}
                            className={`${isMobile ? 'relative' : 'absolute left-0 top-1/2 -translate-y-1/2'
                                } w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-900 border border-white/20 flex items-center justify-center text-white hover:bg-blue-600 transition-all shadow-2xl active:scale-90`}
                        >
                            <ChevronLeft size={isMobile ? 24 : 28} />
                        </motion.button>

                        <motion.button
                            initial={{ scale: 0.8 }}
                            animate={{
                                scale: (isPaused || isMobile) ? 1 : 0.8,
                                x: isMobile ? 0 : 85,
                                pointerEvents: (isPaused || isMobile) && !selectedFeature ? 'auto' : 'none'
                            }}
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleManualMove('right');
                            }}
                            className={`${isMobile ? 'relative' : 'absolute right-0 top-1/2 -translate-y-1/2'
                                } w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-900 border border-white/20 flex items-center justify-center text-white hover:bg-blue-600 transition-all shadow-2xl active:scale-90`}
                        >
                            <ChevronRight size={isMobile ? 24 : 28} />
                        </motion.button>
                    </div>
                </motion.div>
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
