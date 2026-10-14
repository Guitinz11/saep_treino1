import { getDatabase } from '@netlify/database';
import { drizzle } from 'drizzle-orm/netlify-db';
import * as schema from './schema.js';

export function createDatabase() {
    const connection = getDatabase();
    return Object.assign(drizzle({ schema, client: connection }), {
        close: () => connection.pool.end(),
    });
}
