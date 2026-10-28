import { BASE_PATH } from '@/lib/basePath';

export default function Logo({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`${BASE_PATH}/logo.svg`} width={size} height={size} alt="Kameramera logo" className={className} />
  );
}
