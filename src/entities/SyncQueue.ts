import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type SyncAction = 'create' | 'update' | 'delete';
export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';
export type SyncEntityType = 'transaction' | 'category' | 'invoice' | 'recurring' | 'project';

@Entity('sync_queue')
export class SyncQueue {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  entityType!: SyncEntityType;

  @Column({ type: 'varchar' })
  entityId!: string;

  @Column({ type: 'varchar' })
  action!: SyncAction;

  @Column({ type: 'varchar', default: 'pending' })
  status!: SyncStatus;

  @Column({ type: 'int', default: 0 })
  retries!: number;

  @Column({ type: 'varchar', nullable: true })
  lastError?: string;

  @CreateDateColumn({ type: 'datetime' })
  createdAt!: Date;

  @Column({ type: 'datetime', nullable: true })
  syncedAt?: Date;
}
