import { useEffect, useRef, useState } from 'react';
import './CardVideo.css';

interface Props {
  url: string;
  isActive: boolean; // the music is playing, so the video plays too
}

/** A song's looping video, shown over its cover. It fades in once it can play, and steps aside if it fails. */
export function CardVideo({ url, isActive }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);

  // A different video (a new song): start over with the cover showing.
  useEffect(() => {
    setIsReady(false);
    setHasFailed(false);
  }, [url]);

  // The video follows the music: it pauses when the music does.
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (isActive) element.play().catch(() => {});
    else element.pause();
  }, [isActive, url, isReady]);

  if (hasFailed) return null; // the cover stays

  return (
    <video
      ref={video}
      className={`card-video${isReady ? ' ready' : ''}`}
      src={url}
      muted
      loop
      playsInline
      autoPlay
      preload="auto"
      onCanPlay={() => setIsReady(true)}
      onError={() => setHasFailed(true)}
    />
  );
}
