import { Check } from 'lucide-react';

export function StepProgress({ labels, step }: { labels: readonly string[]; step: number }) {
  return <ol className="registration-steps" aria-label="Etapas do cadastro">
    {labels.map((label, index) => <li key={label} aria-current={step === index + 1 ? 'step' : undefined} className={index + 1 < step ? 'is-complete' : undefined}>
      <span className="registration-steps__number" aria-hidden="true">{index + 1 < step ? <Check size={14} /> : index + 1}</span><span>{label}</span>
    </li>)}
  </ol>;
}
