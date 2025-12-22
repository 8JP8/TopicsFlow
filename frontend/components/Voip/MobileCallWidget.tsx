import React, { useState, useEffect, useRef } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { useVoip } from '../../contexts/VoipContext';
import VoipControlBar from './VoipControlBar';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const MobileCallWidget: React.FC = () => {
    const { activeCall, isDocked, setIsDocked } = useVoip();
    const isMobile = useMediaQuery('(max-width: 768px)');
    const constraintsRef = useRef<HTMLDivElement>(null);

    // Only render on mobile and when there is an active call
    if (!activeCall || !isMobile || isDocked) return null;

    const toggleDock = () => {
        setIsDocked(!isDocked);
    };

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
