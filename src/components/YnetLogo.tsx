/**
 * ynet wordmark — red-circle "y" symbol + "net". A faithful, theme-aware recreation
 * (the "net" uses currentColor so it flips black↔white with the theme). Swap in the
 * official vector from the ynet Design System for production.
 */
export default function YnetLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 106 40" role="img" aria-label="ynet" fill="none">
      <circle cx="20" cy="20" r="20" fill="#de1a1a" />
      <text x="20.5" y="29.5" textAnchor="middle" fontFamily="var(--font)" fontSize="30" fontWeight="800" fill="#ffffff">y</text>
      <text x="46" y="29.5" fontFamily="var(--font)" fontSize="29" fontWeight="800" letterSpacing="-1.2" fill="currentColor">net</text>
    </svg>
  );
}
