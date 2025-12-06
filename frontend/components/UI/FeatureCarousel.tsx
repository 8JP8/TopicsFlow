import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, MessageSquare, Users, Paperclip, Ticket } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface FeatureSlide {
    title: string;
    description: string;
    icon: JSX.Element;
    color: string;
}

export default function FeatureCarousel() {
    const [currentSlide, setCurrentSlide] = useState(0);
    const { t } = useLanguage();

    const features: FeatureSlide[] = [
        {
            title: t('about.carousel.topicsTitle') || "Diverse Topics",
            description: t('about.carousel.topicsDesc') || "Dive into a wide range of discussions. From tech to art, find your niche or create your own topic to start a new community.",
            icon: <MessageSquare className="w-16 h-16 text-blue-400" />,
            color: "from-blue-500/20 to-blue-600/5"
        },
        {
            title: t('about.carousel.chatTitle') || "Real-time Chatrooms",
            description: t('about.carousel.chatDesc') || "Experience fluid, instant messaging. Connect with others in real-time with responsive chat rooms designed for modern interaction.",
            icon: <Users className="w-16 h-16 text-purple-400" />,
            color: "from-purple-500/20 to-purple-600/5"
        },
        {
            title: t('about.carousel.attachTitle') || "Rich Attachments",
            description: t('about.carousel.attachDesc') || "Share more than just words. Upload images, files, and GIFs to make your conversations come alive.",
            icon: <Paperclip className="w-16 h-16 text-emerald-400" />,
            color: "from-emerald-500/20 to-emerald-600/5"
        },
        {
            title: t('about.carousel.ticketTitle') || "Ticket System",
            description: t('about.carousel.ticketDesc') || "Comprehensive support and moderation. Report issues and track their status seamlessly through our integrated ticket system.",
            icon: <Ticket className="w-16 h-16 text-orange-400" />,
            color: "from-orange-500/20 to-orange-600/5"
        }
    ];

    const nextSlide = () => {
        setCurrentSlide((prev) => (prev + 1) % features.length);
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + features.length) % features.length);
    };

    // Auto-advance
    useEffect(() => {
        const timer = setInterval(nextSlide, 5000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="relative w-full max-w-4xl mx-auto mt-16 px-4">
            <div className="relative bg-gray-800/50 backdrop-blur-md border border-gray-700 rounded-3xl overflow-hidden shadow-2xl min-h-[400px]">

                {/* Slide Content */}
                <div className="absolute inset-0 transition-all duration-700 ease-in-out">
                    <div
                        className={`w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br ${features[currentSlide].color}`}
                    >
                        <div className="mb-6 transform transition-all duration-500 scale-100 hover:scale-110">
                            {features[currentSlide].icon}
                        </div>
                        <h3 className="text-3xl font-bold text-white mb-4 text-center">
                            {features[currentSlide].title}
                        </h3>
                        <p className="text-lg text-gray-300 text-center max-w-lg leading-relaxed">
                            {features[currentSlide].description}
                        </p>
                    </div>
                </div>

                {/* Navigation Buttons */}
                <button
                    onClick={prevSlide}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-gray-900/50 hover:bg-blue-600/80 text-white transition-all backdrop-blur-sm z-10"
                >
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                    onClick={nextSlide}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-gray-900/50 hover:bg-blue-600/80 text-white transition-all backdrop-blur-sm z-10"
                >
                    <ChevronRight className="w-6 h-6" />
                </button>

                {/* Indicators */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-3 z-10">
                    {features.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentSlide(index)}
                            className={`w-3 h-3 rounded-full transition-all duration-300 ${index === currentSlide ? 'bg-blue-500 w-8' : 'bg-gray-600 hover:bg-gray-500'
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
