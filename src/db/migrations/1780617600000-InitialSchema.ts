import type { MigrationInterface, QueryRunner } from 'typeorm';

// Baseline migration. Uses CREATE TABLE IF NOT EXISTS so it's a no-op on DBs that
// were already created by the old synchronize:true path — those just get this
// migration recorded so future migrations run cleanly. Fresh installs get the
// full schema here. SQL is TypeORM's own synchronize output, verbatim.
export class InitialSchema1780617600000 implements MigrationInterface {
  name = 'InitialSchema1780617600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "users" ("id" varchar PRIMARY KEY NOT NULL, "email" varchar, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"))`
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "categories" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar, "name" varchar NOT NULL, "type" varchar NOT NULL, "isDefault" boolean NOT NULL DEFAULT (0), "color" varchar, CONSTRAINT "UQ_0b07dc60ebad06aad503ab0d28c" UNIQUE ("name", "type", "userId"), CONSTRAINT "FK_13e8b2a21988bec6fdcbb1fa741" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "profiles" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "companyName" varchar NOT NULL, "address" text NOT NULL, "taxId" varchar, "isKleinunternehmer" boolean NOT NULL DEFAULT (0), "bankDetails" text, "phone" varchar, "email" varchar, CONSTRAINT "REL_315ecd98bd1a42dcf2ec4e2e98" UNIQUE ("userId"), CONSTRAINT "FK_315ecd98bd1a42dcf2ec4e2e985" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "projects" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "name" varchar NOT NULL, "description" varchar, "status" varchar NOT NULL DEFAULT ('active'), "color" varchar, "budget" decimal(10,2), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_6766d8b267c54062bb52d09e9d7" UNIQUE ("name", "userId"), CONSTRAINT "FK_361a53ae58ef7034adc3c06f09f" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "transactions" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "type" varchar NOT NULL, "amount" decimal(10,2) NOT NULL, "currency" varchar NOT NULL DEFAULT ('EUR'), "categoryId" varchar, "description" varchar NOT NULL, "date" date NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "projectId" varchar, "metadata" text, CONSTRAINT "FK_6bb58f2b6e30cb51a6504599f41" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_86e965e74f9cc66149cf6c90f64" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_92d1d5070de965ff398a522b4ff" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "invoices" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "invoiceNumber" varchar NOT NULL, "clientName" varchar NOT NULL, "clientAddress" text, "items" text NOT NULL, "totalAmount" decimal(10,2) NOT NULL, "date" date NOT NULL, "dueDate" date, "status" varchar NOT NULL DEFAULT ('draft'), "pdfPath" varchar, "notes" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_8922bb867dee7fe99ef6b79c8c8" UNIQUE ("userId", "invoiceNumber"), CONSTRAINT "FK_fcbe490dc37a1abf68f19c5ccb9" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "recurring_transactions" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "type" varchar NOT NULL, "amount" decimal(10,2) NOT NULL, "description" varchar NOT NULL, "categoryId" varchar, "interval" varchar NOT NULL, "startDate" date NOT NULL, "endDate" date, "lastProcessed" date, "nextDue" date, "active" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_ab59c63725771bd11c6e1d719a2" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_d7578f10f8eeaec6241f19dd6e4" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "budgets" ("id" varchar PRIMARY KEY NOT NULL, "userId" varchar NOT NULL, "name" varchar, "amount" decimal(10,2) NOT NULL, "period" varchar NOT NULL DEFAULT ('monthly'), "categoryId" varchar, "active" boolean NOT NULL DEFAULT (1), "alertThreshold" decimal(5,2) NOT NULL DEFAULT (80), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_27e688ddf1ff3893b43065899f9" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION, CONSTRAINT "FK_3ece6e1292b7a86ba82145775a7" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION)`
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "budgets"`);
    await queryRunner.query(`DROP TABLE "recurring_transactions"`);
    await queryRunner.query(`DROP TABLE "invoices"`);
    await queryRunner.query(`DROP TABLE "transactions"`);
    await queryRunner.query(`DROP TABLE "projects"`);
    await queryRunner.query(`DROP TABLE "profiles"`);
    await queryRunner.query(`DROP TABLE "categories"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
