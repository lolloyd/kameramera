import type { Metadata, Viewport } from 'next';
import { Fredoka, Montserrat, Open_Sans } from 'next/font/google';
import ActiveEventLoader from '@/components/ActiveEventLoader';
import Header from '@/components/Header';
import RegisterSW from '@/components/RegisterSW';
import SessionKeeper from '@/components/SessionKeeper';
import { BASE_PATH } from '@/lib/basePath';
import './globals.css';

const fredoka = Fredoka({ subsets: ['latin'], variable: '--font-fredoka', display: 'swap' });
const montserrat = Montserrat({ subsets: ['latin'], weight: ['800'], variable: '--font-montserrat', display: 'swap' });
const openSans = Open_Sans({ subsets: ['latin'], weight: ['400'], variable: '--font-open-sans', display: 'swap' });

const description = 'A simple photobooth that runs in your browser. Photos never leave your device.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: 'Kameramera',
  description,
  manifest: `${BASE_PATH}/manifest.webmanifest`,
  icons: {
    icon: `${BASE_PATH}/logo.svg`,
    apple: `${BASE_PATH}/apple-touch-icon.png`,
  },
  openGraph: {
    title: 'Kameramera',
    description,
    images: [{ url: `${BASE_PATH}/og-image.png`, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', title: 'Kameramera', description, images: [`${BASE_PATH}/og-image.png`] },
};

export const viewport: Viewport = {
  themeColor: '#0B1226',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${montserrat.variable} ${openSans.variable}`}>
      <body className="font-sans">
        <Header />
        <main className="w-full px-4 pb-10 sm:px-6 lg:px-10">{children}</main>
        <RegisterSW />
        <ActiveEventLoader />
        <SessionKeeper />
      </body>
    </html>
  );
}
