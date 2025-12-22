import React, { useState, useEffect, useRef } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { useVoip } from '../../contexts/VoipContext';
import VoipControlBar from './VoipControlBar';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const MobileCallWidget: React.FC = () => {
    const { activeCall } = useVoip();
    const [isDocked, setIsDocked] = useState(false);
    const isMobile = useMediaQuery('(max-width: 768px)');
    const constraintsRef = useRef<HTMLDivElement>(null);

    // Only render on mobile and when there is an active call
    if (!activeCall || !isMobile) return null;

    const toggleDock = () => {
        setIsDocked(!isDocked);
    };

    if (isDocked) {
        return (
            <div className="fixed bottom-16 left-0 right-0 z-50 px-4 py-2 bg-transparent pointer-events-none flex justify-center">
                <div className="pointer-events-auto w-full max-w-md shadow-2xl">
                    <VoipControlBar
                        variant="floating" // Use floating variant for rounded look
                        showLabels={true}
                        onDock={toggleDock}
                        isDocked={true}
                    />
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Constraints container for dragging */}
            <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-50" />

            <motion.div
                drag
                dragConstraints={constraintsRef}
                dragMomentum={false}
                initial={{ x: 0, y: 0 }}
                className="fixed bottom-24 right-4 z-50 pointer-events-auto shadow-2xl"
            // Prevent dragging when interacting with internal buttons handled by not propagating events 
            // but Framer Motion handles clickable children well.
            >
                <div className="max-w-[320px]">
                    <VoipControlBar
                        variant="floating"
                        showLabels={true}
                        onDock={toggleDock}
                        isDocked={false}
                    />
                </div>
            </motion.div>
        </>
    );
};

export default MobileCallWidget;
