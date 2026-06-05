import type { ValueTransformer } from 'typeorm';

// better-sqlite3 hands decimal columns back as strings, so without this every
// read of a money field would need a Number() cast and one forgotten cast lands
// a string (or NaN) in a tax export. Keep the field a real number on read.
export const moneyTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value == null ? value : Number(value)),
};
