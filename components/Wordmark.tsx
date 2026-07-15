interface Props {
  top: string;
  bottom: string;
  className?: string;
}

// Both lines share the same tracking and are left-aligned as a block via
// flex - a shorter top word (e.g. "CULTURAL" vs "LANDSCAPE") simply extends
// less far to the right rather than getting its own compensating
// letter-spacing, so the rhythm between letters reads identically on both
// words.
export default function Wordmark({ top, bottom, className }: Props) {
  return (
    <div className={`flex flex-col items-start ${className ?? ""}`}>
      <p className="whitespace-nowrap leading-tight tracking-widest">{top}</p>
      <p className="whitespace-nowrap leading-tight tracking-widest">{bottom}</p>
    </div>
  );
}
