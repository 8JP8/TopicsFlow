import React from 'react';

// Base colors available in Tailwind (excluding gray, white, black, yellow, amber for vibrancy)
// Using colors that are vibrant and distinct, avoiding neutral tones
const COLOR_CLASSES = [
    'bg-red-500', 'bg-orange-500', 'bg-lime-500',
    'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500',
    'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500',
    'bg-pink-500', 'bg-rose-500'
];

// Color names without 'bg-' prefix for gradients
const COLOR_NAMES = [
    'red', 'orange', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky',
    'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose'
];

const STORAGE_KEY = 'user_colors_cache_v2';

/**
 * Get cached colors from localStorage
 */
const getCachedColors = (): Record<string, string> => {
    if (typeof window === 'undefined') return {};
    try {
        const cached = localStorage.getItem(STORAGE_KEY);
        return cached ? JSON.parse(cached) : {};
    } catch {
        return {};
    }
};

/**
 * Save color to cache
 */
const saveColorToCache = (identifier: string, colorClass: string): void => {
    if (typeof window === 'undefined') return;
    try {
        const cached = getCachedColors();
        cached[identifier] = colorClass;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    } catch {
        // Ignore storage errors
    }
};

/**
 * Generates a deterministic index based on a string input
 */
const getIndex = (str: string, length: number): number => {
    if (!str) return 0;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % length;
};

/**
 * Returns a consistent tailwind background color class for a user
 * Colors are cached in localStorage to persist between sessions
 * Example: 'bg-red-500'
 */
export const getUserColorClass = (identifier?: string): string => {
    if (!identifier) return 'bg-gray-500';

    // Check cache first
    const cached = getCachedColors();
    if (cached[identifier]) {
        return cached[identifier];
    }

    // Generate color deterministically
    const index = getIndex(identifier, COLOR_CLASSES.length);
    const colorClass = COLOR_CLASSES[index];

    // Save to cache
    saveColorToCache(identifier, colorClass);

    return colorClass;
};

/**
 * Returns a consistent tailwind gradient classes for a user banner
 * The 'from' color matches the user's avatar color
 * The 'to' color is chosen deterministically but pseudo-randomly based on the identifier
 * Example: 'bg-gradient-to-r from-red-500 to-blue-500'
 */
// Color hex values mapping for gradients (using Tailwind 500 shades)
const COLOR_HEX_MAP: Record<string, string> = {
    'red': '#ef4444',
    'orange': '#f97316',
    'lime': '#84cc16',
    'green': '#22c55e',
    'emerald': '#10b981',
    'teal': '#14b8a6',
    'cyan': '#06b6d4',
    'sky': '#0ea5e9',
    'blue': '#3b82f6',
    'indigo': '#6366f1',
    'violet': '#8b5cf6',
    'purple': '#a855f7',
    'fuchsia': '#d946ef',
    'pink': '#ec4899',
    'rose': '#f43f5e',
};

/**
 * Returns a consistent gradient style object for a user banner
 * The 'from' color matches the user's avatar color
 * The 'to' color is chosen deterministically but pseudo-randomly based on the identifier
 * Gradients are cached in localStorage to persist between sessions
 */
export const getUserBannerGradient = (identifier?: string): React.CSSProperties => {
    if (!identifier) {
        return {
            background: 'linear-gradient(to right, #6b7280, #374151)',
        };
    }

    const GRADIENT_CACHE_KEY = 'user_banner_gradients_cache_v2';

    // Check cache first
    if (typeof window !== 'undefined') {
        try {
            const cached = localStorage.getItem(GRADIENT_CACHE_KEY);
            if (cached) {
                const gradients = JSON.parse(cached);
                if (gradients[identifier]) {
                    return gradients[identifier];
                }
            }
        } catch {
            // Ignore cache errors
        }
    }

    // Get the avatar color index to match the banner start color
    const avatarColorIndex = getIndex(identifier, COLOR_CLASSES.length);
    const color1Name = COLOR_NAMES[avatarColorIndex % COLOR_NAMES.length];
    const color1Hex = COLOR_HEX_MAP[color1Name] || COLOR_HEX_MAP['blue'];

    // Get a different color for the gradient end
    const index2 = getIndex(identifier + '_gradient_end', COLOR_NAMES.length);
    const finalIndex2 = color1Name === COLOR_NAMES[index2] ? (index2 + 1) % COLOR_NAMES.length : index2;
    const color2Name = COLOR_NAMES[finalIndex2];
    const color2Hex = COLOR_HEX_MAP[color2Name] || COLOR_HEX_MAP['purple'];

    // Create gradient style object
    const gradientStyle: React.CSSProperties = {
        background: `linear-gradient(to right, ${color1Hex}, ${color2Hex})`,
    };

    // Save to cache
    if (typeof window !== 'undefined') {
        try {
            const cached = localStorage.getItem(GRADIENT_CACHE_KEY);
            const gradients = cached ? JSON.parse(cached) : {};
            gradients[identifier] = gradientStyle;
            localStorage.setItem(GRADIENT_CACHE_KEY, JSON.stringify(gradients));
        } catch {
            // Ignore storage errors
        }
    }

    return gradientStyle;
};

