import React, { useRef, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Award, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlumniPrideVideoProps {
    className?: string;
    showTitle?: boolean;
}

export const AlumniPrideVideo: React.FC<AlumniPrideVideoProps> = ({
    className,
    showTitle = true
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    video.play().catch(err => console.log("Autoplay blocked:", err));
                } else {
                    video.pause();
                }
            },
            { threshold: 0.5 } // Play when at least 50% of the video is visible
        );

        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            if (containerRef.current) {
                observer.unobserve(containerRef.current);
            }
        };
    }, []);

    return (
        <div className={cn("w-full mx-auto", className)} ref={containerRef}>
            {showTitle && (
                <div className="text-center mb-10">
                    <div className="inline-block mb-3">
                        <span className="bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-sm font-semibold uppercase tracking-wide flex items-center gap-2">
                            <Award className="w-4 h-4" /> Global Success Stories
                        </span>
                    </div>
                    <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 bg-clip-text text-transparent mb-4">
                        Our Alumni Pride
                    </h2>
                    <p className="text-gray-600 text-lg max-w-2xl mx-auto font-medium">
                        From premier universities to industry leading organizations, see how TKS alumni are making an impact globally.
                    </p>
                </div>
            )}

            <Card className="overflow-hidden border-0 shadow-2xl rounded-3xl bg-[#001a14] relative group">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#008060]/20 via-transparent to-[#a6ce39]/10 pointer-events-none z-0"></div>
                <CardContent className="p-0 relative z-10 group">
                    <div className="relative aspect-video bg-black">
                        <video
                            ref={videoRef}
                            src="/videos/alumni-landing-page.mp4"
                            className="w-full h-full object-cover"
                            muted={isMuted}
                            loop
                            playsInline
                            preload="auto"
                        />
                        
                        {/* Audio Toggle Button */}
                        <div className="absolute bottom-4 right-4 z-20 transition-opacity">
                            <button
                                onClick={() => setIsMuted(!isMuted)}
                                className="bg-black/50 hover:bg-black/70 text-white p-3 rounded-full backdrop-blur-md border border-white/20 transition-all active:scale-95 flex items-center justify-center"
                                title={isMuted ? "Unmute" : "Mute"}
                            >
                                {isMuted ? (
                                    <VolumeX className="w-5 h-5" />
                                ) : (
                                    <Volume2 className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};
