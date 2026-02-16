import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import type { Profile } from './Profile.js';
import type { Transaction } from './Transaction.js';
import type { Invoice } from './Invoice.js';

export type UserTier = 'free' | 'pro';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email?: string;

  @Column({ type: 'varchar', default: 'free' })
  tier!: UserTier;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @OneToOne('Profile', 'user')
  profile?: Profile;

  @OneToMany('Transaction', 'user')
  transactions?: Transaction[];

  @OneToMany('Invoice', 'user')
  invoices?: Invoice[];
}
