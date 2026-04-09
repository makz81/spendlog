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
import type { Project } from './Project.js';

export type TransactionType = 'income' | 'expense';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @ManyToOne('User', 'transactions')
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar' })
  type!: TransactionType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', default: 'EUR' })
  currency!: string;

  @Column({ type: 'varchar', nullable: true })
  categoryId?: string;

  @ManyToOne('Category', { nullable: true })
  @JoinColumn({ name: 'categoryId' })
  category?: Category;

  @Column({ type: 'varchar' })
  description!: string;

  @Column({ type: 'date' })
  date!: Date;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @Column({ type: 'varchar', nullable: true })
  projectId?: string;

  @ManyToOne('Project', { nullable: true })
  @JoinColumn({ name: 'projectId' })
  project?: Project;

  @Column({ type: 'simple-json', nullable: true })
  metadata?: Record<string, unknown>;
}
