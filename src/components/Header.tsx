import Link from 'next/link';
import Logo from './Logo';

const navLink =
  'rounded-full border border-kame-blue/50 px-4 py-2 font-semibold transition hover:border-kame-cyan focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kame-blue/60';

export default function Header() {
  return (
    <header className="flex w-full items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
      <Link href="/" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-kame-blue/60">
        <Logo size={44} />
        <span className="text-2xl font-bold tracking-wide">Kameramera</span>
      </Link>
      <nav aria-label="Main" className="flex gap-2">
        <Link href="/events/" className={navLink}>
          Events
        </Link>
        <Link href="/gallery/" className={navLink}>
          Gallery
        </Link>
      </nav>
    </header>
  );
}
