"use client";

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';

interface GlobeBackgroundProps {
    className?: string;
}

function GlobeBackgroundInner({ className = '' }: GlobeBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [scrollY, setScrollY] = useState(0);
    const phiRef = useRef(0);
    const globeRef = useRef<any>(null);

    // Scroll handler
    useEffect(() => {
        const handleScroll = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        if (!canvasRef.current) return;

        let width = 600;

        const initGlobe = async () => {
            const createGlobe = (await import('cobe')).default;

            if (!canvasRef.current) return;

            // Cities
            const cities = [
                { location: [40.7128, -74.006], size: 0.06 }, // New York
                { location: [51.5074, -0.1278], size: 0.06 }, // London
                { location: [35.6762, 139.6503], size: 0.06 }, // Tokyo
                { location: [-23.5505, -46.6333], size: 0.05 }, // São Paulo
                { location: [48.8566, 2.3522], size: 0.05 }, // Paris
                { location: [52.5200, 13.4050], size: 0.05 }, // Berlin
                { location: [38.7223, -9.1393], size: 0.07 }, // Lisbon
                { location: [41.1579, -8.6291], size: 0.08 }, // Porto
                { location: [39.9042, 116.4074], size: 0.05 }, // Beijing
                { location: [-33.8688, 151.2093], size: 0.05 }, // Sydney
                { location: [1.3521, 103.8198], size: 0.05 }, // Singapore
                { location: [25.2048, 55.2708], size: 0.05 }, // Dubai
                { location: [19.0760, 72.8777], size: 0.04 }, // Mumbai
                { location: [55.7558, 37.6173], size: 0.05 }, // Moscow
                { location: [-34.6037, -58.3816], size: 0.04 }, // Buenos Aires
            ];

            // Initialize random flights
            const flights = Array.from({ length: 15 }, () => {
                const start = cities[Math.floor(Math.random() * cities.length)];
                let end = cities[Math.floor(Math.random() * cities.length)];
                while (start === end) {
                    end = cities[Math.floor(Math.random() * cities.length)];
                }
                return {
                    start: start.location,
                    end: end.location,
                    progress: Math.random(),
                    speed: 0.003 + Math.random() * 0.003
                };
            });

            const interpolate = (start: number[], end: number[], progress: number) => {
                const [lat1, lng1] = start;
                const [lat2, lng2] = end;
                const lat = lat1 + (lat2 - lat1) * progress;
                let dLng = lng2 - lng1;
                if (dLng > 180) dLng -= 360;
                if (dLng < -180) dLng += 360;
                const lng = lng1 + dLng * progress;
                return [lat, lng];
            };

            globeRef.current = createGlobe(canvasRef.current, {
                devicePixelRatio: 2,
                width: width * 2,
                height: width * 2,
                phi: 0,
                theta: 0.3,
                dark: 1,
                diffuse: 1.2,
                mapSamples: 16000,
                mapBrightness: 6,
                baseColor: [0.3, 0.3, 0.3],
                markerColor: [0.133, 0.827, 0.933], // Cyan #22d3ee
                glowColor: [0.1, 0.4, 0.5],
                markers: [], // Start empty, population in onRender
                onRender: (state) => {
                    phiRef.current += 0.003;
                    state.phi = phiRef.current;

                    const currentMarkers = [...cities];

                    // Update and draw flights
                    flights.forEach(flight => {
                        flight.progress += flight.speed;
                        if (flight.progress >= 1) {
                            const start = cities[Math.floor(Math.random() * cities.length)];
                            let end = cities[Math.floor(Math.random() * cities.length)];
                            while (start === end) end = cities[Math.floor(Math.random() * cities.length)];
                            flight.start = start.location;
                            flight.end = end.location;
                            flight.progress = 0;
                        }

                        const [lat, lng] = interpolate(flight.start, flight.end, flight.progress);
                        // Add plane marker
                        currentMarkers.push({
                            location: [lat, lng],
                            size: 0.03
                        });
                    });

                    state.markers = currentMarkers;
                },
            });

            if (canvasRef.current) {
                canvasRef.current.style.opacity = '1';
            }
        };

        initGlobe();

        return () => {
            if (globeRef.current) {
                globeRef.current.destroy();
            }
        };
    }, []);

    return (
        <div
            className={`fixed inset-0 flex items-center justify-center overflow-hidden pointer-events-none ${className}`}
            style={{ transform: `translateY(${scrollY * 0.15}px)` }}
        >
            <div className="relative" style={{ width: 600, height: 600 }}>
                <canvas
                    ref={canvasRef}
                    width={1200}
                    height={1200}
                    className="w-full h-full opacity-0 transition-opacity duration-1000"
                    style={{ contain: 'layout paint size' }}
                />
            </div>

            {/* Vignette */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(15, 23, 42, 0.7) 100%)' }}
            />
        </div>
    );
}

export default dynamic(() => Promise.resolve(GlobeBackgroundInner), {
    ssr: false,
    loading: () => (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[600px] h-[600px] rounded-full bg-slate-800/20 animate-pulse" />
        </div>
    ),
});
