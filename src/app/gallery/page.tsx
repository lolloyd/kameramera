import type { Metadata } from 'next';
import Gallery from '@/components/Gallery';

export const metadata: Metadata = { title: 'Gallery · Kameramera' };

export default function GalleryPage() {
  return <Gallery />;
}
