import { sql } from 'drizzle-orm';
import { check, date, index, integer, numeric, pgTable, pgView, serial, varchar } from 'drizzle-orm/pg-core';

export const produtos = pgTable('produtos', {
    id: serial('id').primaryKey(),
    nome: varchar('nome', { length: 255 }).notNull(),
    valor: numeric('valor', { precision: 10, scale: 2 }).notNull(),
    quantidade: integer('quantidade').notNull(),
    categoria: varchar('categoria', { length: 255 }).notNull(),
    unidade_medida: varchar('unidade_medida', { length: 30 }).notNull(),
}, (table) => [
    check('produtos_valor_positivo', sql`${table.valor} > 0`),
    check('produtos_estoque_nao_negativo', sql`${table.quantidade} >= 0`),
]);

export const movimentacoes = pgTable('movimentacoes', {
    id: serial('id').primaryKey(),
    data: date('data', { mode: 'string' }).notNull(),
    tipo: varchar('tipo', { length: 10 }).notNull(),
    quantidade: integer('quantidade').notNull(),
    produtos_id: integer('produtos_id').notNull().references(() => produtos.id),
}, (table) => [
    check('movimentacoes_quantidade_positiva', sql`${table.quantidade} > 0`),
    check('movimentacoes_tipo_valido', sql`${table.tipo} in ('entrada', 'saída')`),
    index('movimentacoes_produto_data_idx').on(table.produtos_id, table.data),
    index('movimentacoes_data_idx').on(table.data),
]);

export const estoque = pgView('vw_estoque').as((query) => query.select({
    id: produtos.id,
    nome: produtos.nome,
    quantidade: produtos.quantidade,
    valor: produtos.valor,
    valor_total: sql<string>`${produtos.quantidade} * ${produtos.valor}`.as('valor_total'),
    categoria: produtos.categoria,
}).from(produtos));
