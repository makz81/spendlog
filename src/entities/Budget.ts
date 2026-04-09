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

export type BudgetPeriod = 'monthly' | 'quarterly' | 'yearly';

@Entity('budgets')
export class Budget {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @ManyToOne('User')
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar', nullable: true })
  name?: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', default: 'monthly' })
  period!: BudgetPeriod;

  @Column({ type: 'varchar', nullable: true })
  categoryId?: string | null;

  @ManyToOne('Category', { nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category?: Category;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 80 })
  alertThreshold!: number;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}
