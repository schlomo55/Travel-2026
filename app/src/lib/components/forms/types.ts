/* Schema-driven forms: one renderer, one small spec per entity.
   Values are held in a flat Record<string, unknown> keyed by field name and
   mapped to/from the entity by the spec. */

export type FieldValue = string | number | boolean | string[] | { k: string; v: string; warn?: boolean }[] | undefined;
export type FormValues = Record<string, FieldValue>;

interface Base {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  /** Show this field only when the predicate passes (e.g. flight-only fields). */
  when?: (v: FormValues) => boolean;
  width?: 'full' | 'half';
}

export type FieldSpec =
  | (Base & { type: 'text'; placeholder?: string; maxlength?: number })
  | (Base & { type: 'mdlite'; placeholder?: string; rows?: number })
  | (Base & { type: 'date' })
  | (Base & { type: 'time' })
  | (Base & { type: 'number'; min?: number; max?: number; step?: number })
  | (Base & { type: 'money'; currency: string })
  | (Base & { type: 'select'; options: { value: string; label: string }[] })
  | (Base & { type: 'toggle' })
  | (Base & { type: 'stringList'; placeholder?: string; itemLabel?: string })
  | (Base & { type: 'kvPairs'; keyLabel?: string; valueLabel?: string })
  | (Base & { type: 'hue' });

export interface FormGroup {
  title?: string;
  fields: FieldSpec[];
}

export interface FormSpec<T> {
  title: string;
  groups: FormGroup[];
  /** Entity (or undefined when creating) → form values. */
  toValues: (entity?: T) => FormValues;
  /** Form values → the entity fields to persist. */
  fromValues: (values: FormValues, existing?: T) => T;
  /** Return an error string to block saving. */
  validate?: (values: FormValues) => string | null;
}

export const str = (v: FieldValue): string => (typeof v === 'string' ? v : '');
export const num = (v: FieldValue): number => (typeof v === 'number' ? v : Number(v) || 0);
export const bool = (v: FieldValue): boolean => v === true;
export const list = (v: FieldValue): string[] => (Array.isArray(v) ? (v as string[]).filter((x) => typeof x === 'string') : []);
export const pairs = (v: FieldValue): { k: string; v: string; warn?: boolean }[] =>
  Array.isArray(v) ? (v as { k: string; v: string; warn?: boolean }[]).filter((x) => typeof x === 'object' && x !== null) : [];
/** Optional string: '' becomes undefined so we never store empty keys. */
export const opt = (v: FieldValue): string | undefined => {
  const s = str(v).trim();
  return s === '' ? undefined : s;
};
