'use client';

import { useEffect } from 'react';
import { getActiveEventId } from '@/lib/events';
import { getEvent } from '@/lib/storage';
import { useBooth } from '@/store/booth';

/** Restores the previously selected event on first load. */
export default function ActiveEventLoader() {
  useEffect(() => {
    const id = getActiveEventId();
    if (id === null) return;
    getEvent(id)
      .then((event) => {
        if (event && !useBooth.getState().activeEvent) useBooth.getState().setActiveEvent(event);
      })
      .catch(() => {});
  }, []);
  return null;
}
