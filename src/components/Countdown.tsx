export default function Countdown({ value }: { value: number | null }) {
  if (value === null) return null;
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-live="assertive">
      <span
        key={value}
        className="animate-pop text-[9rem] font-bold leading-none text-white drop-shadow-[0_0_30px_rgba(125,227,255,0.9)]"
      >
        {value}
      </span>
    </div>
  );
}
