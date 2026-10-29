// An ad's `file` may be a video (e.g. an animated Reels/feed ad); it then
// plays muted on a loop, the way Facebook shows it in the feed.
const VIDEO_RE = /\.(mp4|webm|mov)$/i;

export default function AdMedia({ src, alt, className }) {
  if (VIDEO_RE.test(src)) {
    return (
      <video
        className={className}
        src={src}
        aria-label={alt}
        autoPlay
        muted
        loop
        playsInline
        controls
        preload="metadata"
      />
    );
  }
  return <img className={className} src={src} alt={alt} loading="lazy" />;
}
