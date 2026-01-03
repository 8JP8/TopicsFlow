"use client";

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSpring } from 'react-spring';

interface GlobeBackgroundProps {
    className?: string;
}

const LAND_COORDINATES = [
    // North America
    { location: [40.7128, -74.0060], size: 0.06 }, // New York
    { location: [34.0522, -118.2437], size: 0.05 }, // Los Angeles
    { location: [41.8781, -87.6298], size: 0.05 }, // Chicago
    { location: [29.7604, -95.3698], size: 0.04 }, // Houston
    { location: [33.4484, -112.0740], size: 0.04 }, // Phoenix
    { location: [39.9526, -75.1652], size: 0.04 }, // Philadelphia
    { location: [29.4241, -98.4936], size: 0.04 }, // San Antonio
    { location: [32.7157, -117.1611], size: 0.04 }, // San Diego
    { location: [32.7767, -96.7970], size: 0.04 }, // Dallas
    { location: [37.3382, -121.8863], size: 0.04 }, // San Jose
    { location: [43.6532, -79.3832], size: 0.05 }, // Toronto
    { location: [45.5017, -73.5673], size: 0.04 }, // Montreal
    { location: [49.2827, -123.1207], size: 0.04 }, // Vancouver
    { location: [19.4326, -99.1332], size: 0.06 }, // Mexico City
    { location: [20.6597, -103.3496], size: 0.04 }, // Guadalajara
    { location: [25.6866, -100.3161], size: 0.04 }, // Monterrey

    // South America
    { location: [-23.5505, -46.6333], size: 0.06 }, // São Paulo
    { location: [-22.9068, -43.1729], size: 0.05 }, // Rio de Janeiro
    { location: [-34.6037, -58.3816], size: 0.05 }, // Buenos Aires
    { location: [-33.4489, -70.6693], size: 0.05 }, // Santiago
    { location: [-12.0464, -77.0428], size: 0.05 }, // Lima
    { location: [4.7110, -74.0721], size: 0.05 }, // Bogotá
    { location: [10.4806, -66.9036], size: 0.04 }, // Caracas
    { location: [-0.1807, -78.4678], size: 0.04 }, // Quito
    { location: [-16.4897, -68.1193], size: 0.04 }, // La Paz
    { location: [-25.2637, -57.5759], size: 0.04 }, // Asunción
    { location: [-34.9011, -56.1645], size: 0.04 }, // Montevideo

    // Europe
    { location: [51.5074, -0.1278], size: 0.06 }, // London
    { location: [48.8566, 2.3522], size: 0.06 }, // Paris
    { location: [52.5200, 13.4050], size: 0.05 }, // Berlin
    { location: [40.4168, -3.7038], size: 0.05 }, // Madrid
    { location: [41.9028, 12.4964], size: 0.05 }, // Rome
    { location: [55.7558, 37.6173], size: 0.06 }, // Moscow
    { location: [41.0082, 28.9784], size: 0.05 }, // Istanbul
    { location: [52.3676, 4.9041], size: 0.04 }, // Amsterdam
    { location: [50.8503, 4.3517], size: 0.04 }, // Brussels
    { location: [48.2082, 16.3738], size: 0.04 }, // Vienna
    { location: [59.3293, 18.0686], size: 0.04 }, // Stockholm
    { location: [55.6761, 12.5683], size: 0.04 }, // Copenhagen
    { location: [59.9139, 10.7522], size: 0.04 }, // Oslo
    { location: [60.1699, 24.9384], size: 0.04 }, // Helsinki
    { location: [52.2297, 21.0122], size: 0.05 }, // Warsaw
    { location: [50.0755, 14.4378], size: 0.04 }, // Prague
    { location: [47.4979, 19.0402], size: 0.04 }, // Budapest
    { location: [37.9838, 23.7275], size: 0.04 }, // Athens
    { location: [38.7223, -9.1393], size: 0.05 }, // Lisbon
    { location: [41.1579, -8.6291], size: 0.05 }, // Porto
    { location: [53.3498, -6.2603], size: 0.04 }, // Dublin
    { location: [47.3769, 8.5417], size: 0.04 }, // Zurich

    // Africa
    { location: [30.0444, 31.2357], size: 0.05 }, // Cairo
    { location: [6.5244, 3.3792], size: 0.05 }, // Lagos
    { location: [-26.2041, 28.0473], size: 0.05 }, // Johannesburg
    { location: [-33.9249, 18.4241], size: 0.05 }, // Cape Town
    { location: [-1.2921, 36.8219], size: 0.05 }, // Nairobi
    { location: [9.0820, 8.6753], size: 0.04 }, // Abuja
    { location: [5.6037, -0.1870], size: 0.04 }, // Accra
    { location: [14.6928, -17.4467], size: 0.04 }, // Dakar
    { location: [34.0209, -6.8416], size: 0.04 }, // Rabat
    { location: [36.8065, 10.1815], size: 0.04 }, // Tunis
    { location: [8.9806, 38.7578], size: 0.05 }, // Addis Ababa

    // Asia
    { location: [35.6762, 139.6503], size: 0.06 }, // Tokyo
    { location: [39.9042, 116.4074], size: 0.06 }, // Beijing
    { location: [31.2304, 121.4737], size: 0.06 }, // Shanghai
    { location: [22.3193, 114.1694], size: 0.05 }, // Hong Kong
    { location: [37.5665, 126.9780], size: 0.05 }, // Seoul
    { location: [19.0760, 72.8777], size: 0.06 }, // Mumbai
    { location: [28.6139, 77.2090], size: 0.06 }, // New Delhi
    { location: [13.7563, 100.5018], size: 0.05 }, // Bangkok
    { location: [1.3521, 103.8198], size: 0.05 }, // Singapore
    { location: [-6.2088, 106.8456], size: 0.05 }, // Jakarta
    { location: [14.5995, 120.9842], size: 0.05 }, // Manila
    { location: [3.1390, 101.6869], size: 0.05 }, // Kuala Lumpur
    { location: [10.8231, 106.6297], size: 0.05 }, // Ho Chi Minh City
    { location: [25.2048, 55.2708], size: 0.05 }, // Dubai
    { location: [24.7136, 46.6753], size: 0.05 }, // Riyadh
    { location: [32.0853, 34.7818], size: 0.04 }, // Tel Aviv
    { location: [35.6892, 51.3890], size: 0.05 }, // Tehran
    { location: [33.3152, 44.3661], size: 0.04 }, // Baghdad
    { location: [23.6345, 58.3815], size: 0.04 }, // Muscat

    // Oceania
    { location: [-33.8688, 151.2093], size: 0.05 }, // Sydney
    { location: [-37.8136, 144.9631], size: 0.05 }, // Melbourne
    { location: [-27.4698, 153.0251], size: 0.04 }, // Brisbane
    { location: [-31.9505, 115.8605], size: 0.04 }, // Perth
    { location: [-36.8485, 174.7633], size: 0.04 }, // Auckland
    { location: [-41.2865, 174.7762], size: 0.04 }, // Wellington
];

function GlobeBackgroundInner({ className = '' }: GlobeBackgroundProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const globeRef = useRef<any>(null);
    const pointerInteracting = useRef<number | null>(null);
    const pointerInteractionMovement = useRef(0);
    const [scrollY, setScrollY] = useState(0);
    const lastScrollY = useRef(0);
    const scrollVelocity = useRef(0);

    const [{ r }, api] = useSpring(() => ({
        r: 0,
        config: {
            mass: 1,
            tension: 280,
            friction: 40,
            precision: 0.001,
        },
    }));

    // Blinking markers state
    const blinkingMarkersRef = useRef(Array.from({ length: 25 }, () => {
        const randomCity = LAND_COORDINATES[Math.floor(Math.random() * LAND_COORDINATES.length)];
        return {
            location: randomCity.location as [number, number],
            phase: Math.random() * Math.PI * 2,
            speed: 2 + Math.random() * 3
        };
    }));

    // Scroll handler for parallax and velocity boost
    useEffect(() => {
        const handleScroll = () => {
            const currentScroll = window.scrollY;
            const delta = currentScroll - lastScrollY.current;
            lastScrollY.current = currentScroll;
            setScrollY(currentScroll);

            // Boost rotation speed based on scroll speed
            scrollVelocity.current = Math.min(0.15, Math.abs(delta) * 0.005);
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        let phi = 0;
        let width = 0;
        // We use a local variable to track scroll boost inside the render loop 
        // effectively, but since we are modifying a ref (scrollVelocity), 
        // checking it inside the render loop is fine.

        const onResize = () => canvasRef.current && (width = canvasRef.current.offsetWidth);
        window.addEventListener('resize', onResize);
        onResize();

        const initGlobe = async () => {
            const createGlobe = (await import('cobe')).default;

            if (!canvasRef.current) return;

            // Cities
            const cities = LAND_COORDINATES.map(c => ({ ...c, location: c.location as [number, number] }));

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

            const interpolate = (start: [number, number], end: [number, number], progress: number) => {
                const [lat1, lng1] = start;
                const [lat2, lng2] = end;
                const lat = lat1 + (lat2 - lat1) * progress;
                let dLng = lng2 - lng1;
                if (dLng > 180) dLng -= 360;
                if (dLng < -180) dLng += 360;
                const lng = lng1 + dLng * progress;
                return [lat, lng] as [number, number];
            };

            let time = 0;

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
                markerColor: [34 / 255, 211 / 255, 238 / 255],
                glowColor: [0.1, 0.4, 0.5],
                markers: [],
                onRender: (state) => {
                    // This prevents rotation while dragging
                    if (!pointerInteracting.current) {
                        // Auto rotate + scroll boost
                        phi += 0.005 + scrollVelocity.current;
                    }

                    // Friction/decay for scroll velocity
                    if (scrollVelocity.current > 0) {
                        scrollVelocity.current *= 0.95;
                    }

                    state.phi = phi + r.get();
                    state.width = width * 2;
                    state.height = width * 2;

                    time += 0.01;
                    const currentMarkers: any[] = [];

                    // Add blinking markers (land only)
                    blinkingMarkersRef.current.forEach(m => {
                        const size = 0.02 + Math.max(0, Math.sin(time * m.speed + m.phase)) * 0.04;
                        if (size > 0.021) {
                            currentMarkers.push({
                                location: m.location,
                                size: size
                            });
                        }
                    });

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
                        currentMarkers.push({
                            location: [lat, lng],
                            size: 0.03
                        });
                    });

                    state.markers = currentMarkers;
                }
            });

            setTimeout(() => {
                if (canvasRef.current) canvasRef.current.style.opacity = '1';
            });
        };

        // Delay init slightly to ensure container size is ready
        const timer = setTimeout(initGlobe, 100);

        return () => {
            clearTimeout(timer);
            if (globeRef.current) globeRef.current.destroy();
            window.removeEventListener('resize', onResize);
        };
    }, []);

    return (
        <div
            className={`fixed inset-0 flex items-center justify-center overflow-hidden pointer-events-none ${className}`}
            style={{
                transform: `translateY(${scrollY * 0.15}px)`,
                touchAction: 'pan-y'
            }}
        >
            <div className="relative" style={{ width: 600, height: 600 }}>
                <canvas
                    ref={canvasRef}
                    onPointerDown={(e) => {
                        pointerInteracting.current = e.clientX - pointerInteractionMovement.current;
                        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing';
                    }}
                    onPointerUp={() => {
                        pointerInteracting.current = null;
                        if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
                    }}
                    onPointerOut={() => {
                        pointerInteracting.current = null;
                        if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
                    }}
                    onPointerCancel={() => {
                        pointerInteracting.current = null;
                        if (canvasRef.current) canvasRef.current.style.cursor = 'grab';
                    }}
                    onMouseMove={(e) => {
                        if (pointerInteracting.current !== null) {
                            const delta = e.clientX - pointerInteracting.current;
                            pointerInteractionMovement.current = delta;
                            api.start({
                                r: delta / 200,
                            });
                        }
                    }}
                    onTouchMove={(e) => {
                        if (pointerInteracting.current !== null && e.touches[0]) {
                            const delta = e.touches[0].clientX - pointerInteracting.current;
                            pointerInteractionMovement.current = delta;
                            api.start({
                                r: delta / 100,
                            });
                        }
                    }}
                    width={1200}
                    height={1200}
                    className="w-full h-full opacity-0 transition-opacity duration-1000 pointer-events-auto"
                    style={{
                        contain: 'layout paint size',
                        cursor: 'grab',
                        touchAction: 'pan-y'
                    }}
                />
            </div>

            {/* Vignette - Added pointer-events-none to ensures clicks pass through to canvas */}
            <div
                className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(15, 23, 42, 0.7) 100%)' }}
            />
        </div>
    );
}

export default GlobeBackgroundInner;
