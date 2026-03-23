import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
} from 'typeorm';
import type { User } from './User.js';
import type { Category } from './Category.js';

export type RecurringInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type RecurringType = 'income' | 'expense';

@Entity('recurring_transactions')
export class Recurring {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @ManyToOne('User')
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar' })
  type!: RecurringType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar' })
  description!: string;

  @Column({ type: 'varchar', nullable: true })
  categoryId?: string | null;

  @ManyToOne('Category')
  @JoinColumn({ name: 'categoryId' })
  category?: Category;

  @Column({ type: 'varchar' })
  interval!: RecurringInterval;

  @Column({ type: 'date' })
  startDate!: Date;

  @Column({ type: 'date', nullable: true })
  endDate?: Date;

  @Column({ type: 'date', nullable: true })
  lastProcessed?: Date;

  @Column({ type: 'date', nullable: true })
  nextDue?: Date;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}
