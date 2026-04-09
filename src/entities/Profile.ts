import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import type { User } from './User.js';

@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  userId!: string;

  @OneToOne('User', 'profile')
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Column({ type: 'varchar' })
  companyName!: string;

  @Column({ type: 'text' })
  address!: string;

  @Column({ type: 'varchar', nullable: true })
  taxId?: string;

  @Column({ type: 'boolean', default: false })
  isKleinunternehmer!: boolean;

  @Column({ type: 'text', nullable: true })
  bankDetails?: string;

  @Column({ type: 'varchar', nullable: true })
  phone?: string;

  @Column({ type: 'varchar', nullable: true })
  email?: string;
}
