import { Client } from 'pg';
import contractJson from '../../apps/telemetry-backend/src/prisma/contract.json' with {
  type: 'json',
};

/**
 * Derive `CREATE TABLE` DDL directly from the committed Prisma Next contract so
 * the local (in-memory) schema always matches the real deployed schema. We read
 * the storage descriptor (native types, nullability, primary key, defaults,
 * indexes) rather than hand-maintaining a parallel copy that could drift.
 */

type ColumnDescriptor = {
  readonly nativeType: string;
  readonly nullable: boolean;
  readonly default?: { readonly kind: string; readonly expression: string };
};

type TableDescriptor = {
  readonly columns: Record<string, ColumnDescriptor>;
  readonly primaryKey?: { readonly columns: readonly string[] };
  readonly uniques?: ReadonlyArray<{ readonly columns: readonly string[] }>;
  readonly indexes?: ReadonlyArray<{
    readonly name: string;
    readonly columns: readonly string[];
    readonly unique: boolean;
  }>;
};

const storage = (
  contractJson as unknown as {
    storage: {
      namespaces: Record<string, { entries: { table?: Record<string, TableDescriptor> } }>;
    };
  }
).storage;

function columnType(descriptor: ColumnDescriptor): string {
  // `autoincrement()` on an int8 primary key maps to Postgres `bigserial`.
  if (descriptor.default?.expression === 'autoincrement()') {
    return 'bigserial';
  }
  return descriptor.nativeType;
}

function columnClause(name: string, descriptor: ColumnDescriptor): string {
  const parts = [`"${name}"`, columnType(descriptor)];
  if (!descriptor.nullable) {
    parts.push('not null');
  }
  if (descriptor.default?.kind === 'function' && descriptor.default.expression === 'now()') {
    parts.push('default now()');
  }
  return parts.join(' ');
}

function tableStatements(table: string, descriptor: TableDescriptor): string[] {
  const columns = Object.entries(descriptor.columns).map(([name, col]) => columnClause(name, col));
  if (descriptor.primaryKey) {
    const cols = descriptor.primaryKey.columns.map((c) => `"${c}"`).join(', ');
    columns.push(`primary key (${cols})`);
  }
  for (const unique of descriptor.uniques ?? []) {
    const cols = unique.columns.map((c) => `"${c}"`).join(', ');
    columns.push(`unique (${cols})`);
  }

  const statements = [`create table if not exists "${table}" (\n  ${columns.join(',\n  ')}\n)`];
  for (const index of descriptor.indexes ?? []) {
    const cols = index.columns.map((c) => `"${c}"`).join(', ');
    const kind = index.unique ? 'unique index' : 'index';
    statements.push(`create ${kind} if not exists "${index.name}" on "${table}" (${cols})`);
  }
  return statements;
}

/**
 * Applies the contract's schema to a fresh Postgres database. Drops and
 * recreates `public` so repeated boots start from a clean slate.
 */
export async function applyTelemetrySchema(connectionString: string): Promise<void> {
  const client = new Client({ connectionString });
  client.on('error', () => {});
  await client.connect();
  try {
    await client.query('drop schema if exists public cascade');
    await client.query('create schema public');
    for (const namespace of Object.values(storage.namespaces)) {
      for (const [table, descriptor] of Object.entries(namespace.entries.table ?? {})) {
        for (const statement of tableStatements(table, descriptor)) {
          await client.query(statement);
        }
      }
    }
  } finally {
    await client.end().catch(() => {});
  }
}
