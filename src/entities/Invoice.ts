import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  JoinColumn,
  Unique,
} from 'typeorm';
import type { User } from './User.js';

export type InvoiceStatus = 'draft' | 'sent' | 'paid';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

@Entity('invoices')
@Unique(['userId', 'invoiceNumber'])
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @ManyToOne('User', 'invoices')
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar' })
  invoiceNumber!: string; // Format: YYYY-NNN

  @Column({ type: 'varchar' })
  clientName!: string;

  @Column({ type: 'text', nullable: true })
  clientAddress?: string;

  @Column({ type: 'simple-json' })
  items!: InvoiceItem[];

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  totalAmount!: number;

  @Column({ type: 'date' })
  date!: Date;

  @Column({ type: 'date', nullable: true })
  dueDate?: Date;

  @Column({ type: 'varchar', default: 'draft' })
  status!: InvoiceStatus;

  @Column({ type: 'varchar', nullable: true })
  pdfPath?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;
}
