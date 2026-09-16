import React, { useEffect, useRef } from 'react';

interface LoadingAnimationProps {
  onComplete: () => void;
}

const MAX_DURATION_MS = 8000; // 8 seconds playback limit

const LoadingAnimation: React.FC<LoadingAnimationProps> = ({ onComplete }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const completedRef = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleFinish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    onComplete();
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && video.currentTime >= 8) {
      handleFinish();
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('[LoadingAnimation] Autoplay notice:', err.message);
        });
      }
    }

    // Automatically complete after exactly 8 seconds
    timerRef.current = setTimeout(() => {
      handleFinish();
    }, MAX_DURATION_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[99999] w-screen h-screen bg-black flex items-center justify-center overflow-hidden select-none"
      style={{ margin: 0, padding: 0, touchAction: 'none' }}
    >
      <video
        ref={videoRef}
        src="/sree-ai-intro.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        controls={false}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleFinish}
        onError={handleFinish}
        className="w-full h-full object-contain max-w-full max-h-full"
        style={{
          width: '100vw',
          height: '100vh',
          backgroundColor: '#000000'
        }}
      />
    </div>
  );
};

export default LoadingAnimation;
