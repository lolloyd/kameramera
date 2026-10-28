export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'unsupported';

/** Web Share API with files on supporting devices, clipboard otherwise. Expects a PNG blob. */
export async function shareImage(blob: Blob, filename: string): Promise<ShareResult> {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Kameramera' });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      throw e;
    }
  }
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return 'copied';
  }
  return 'unsupported';
}
