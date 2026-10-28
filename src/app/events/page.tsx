import type { Metadata } from 'next';
import EventsManager from '@/components/EventsManager';

export const metadata: Metadata = { title: 'Events · Kameramera' };

export default function EventsPage() {
  return <EventsManager />;
}
