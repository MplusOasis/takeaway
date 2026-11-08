import type { ReactNode } from 'react';

interface FieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}

export function Field({ label, htmlFor, required, hint, error, children }: FieldProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={htmlFor} className="label text-[11px] uppercase text-muted">
          {label}
          {required ? <span className="ml-1 text-accent">*</span> : null}
        </label>
        {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
      </div>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-[12px] text-accent-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}
