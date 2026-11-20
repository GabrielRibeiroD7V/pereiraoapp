import type { ComponentProps } from 'react';

type FormFieldProps = ComponentProps<'input'> & { label: string; id: string };
export function FormField({ label, id, ...props }: FormFieldProps) {
  return <div className="form-field"><label htmlFor={id}>{label}</label><input id={id} {...props} /></div>;
}
