'use client';

import { useState } from 'react';
import { PAPERS, printBlob, type PaperId, type PrintFit } from '@/lib/print';
import { ChipGroup, Stepper } from './controls';

interface Props {
  getBlob: () => Promise<Blob>;
  defaultPaper?: PaperId;
  defaultCopies?: number;
  /** Called after the print window opens, with the number of copies requested. */
  onPrinted?: (copies: number) => void | Promise<void>;
  onClose: () => void;
}

const paperOptions = PAPERS.map((p) => ({ value: p.id, label: p.label }));
const fitOptions: { value: PrintFit; label: string }[] = [
  { value: 'contain', label: 'Whole image' },
  { value: 'cover', label: 'Fill page (may crop)' },
];

export default function PrintDialog({ getBlob, defaultPaper = '4x6', defaultCopies = 1, onPrinted, onClose }: Props) {
  const [paper, setPaper] = useState<PaperId>(defaultPaper);
  const [copies, setCopies] = useState(defaultCopies);
  const [fit, setFit] = useState<PrintFit>('contain');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const print = async () => {
    setWorking(true);
    setError('');
    try {
      await printBlob(await getBlob(), { paper, copies, fit });
      await onPrinted?.(copies);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not print.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Print" className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="card w-full max-w-xl space-y-5">
        <h2 className="text-xl font-bold">Print</h2>

        <div className="space-y-2">
          <span className="text-sm text-white/70">Paper</span>
          <ChipGroup label="Paper" options={paperOptions} value={paper} onChange={setPaper} />
        </div>

        <div className="space-y-2">
          <span className="text-sm text-white/70">{paper === 'strip2' ? 'Sheets (2 strips on each)' : 'Copies'}</span>
          <Stepper label={paper === 'strip2' ? 'sheets' : 'copies'} value={copies} min={1} max={50} onChange={setCopies} />
        </div>

        <div className="space-y-2">
          <span className="text-sm text-white/70">Fit</span>
          <ChipGroup label="Fit" options={fitOptions} value={fit} onChange={setFit} />
        </div>

        <p className="text-sm text-white/60">
          In the print window choose your printer and the same paper size, set margins to None and scale to 100%.
        </p>
        {error && (
          <p role="alert" className="text-rec">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onClose} disabled={working}>
            Cancel
          </button>
          <button type="button" className="btn-primary flex-1" onClick={() => void print()} disabled={working}>
            {working ? 'Preparing…' : 'Print'}
          </button>
        </div>
      </div>
    </div>
  );
}
