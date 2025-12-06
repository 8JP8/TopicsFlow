import { useEffect } from 'react';

const useEscapeKey = (handleClose: () => void) => {
    useEffect(() => {
        const handleEscKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleClose();
            }
        };

        document.addEventListener('keydown', handleEscKey);

        return () => {
            document.removeEventListener('keydown', handleEscKey);
        };
    }, [handleClose]);
};

export default useEscapeKey;
