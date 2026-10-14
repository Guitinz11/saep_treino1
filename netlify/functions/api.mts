import type { Config } from '@netlify/functions';
import { and, between, desc, eq, or, sql } from 'drizzle-orm';
import { createDatabase } from '../../db/index.js';
import { movimentacoes, produtos } from '../../db/schema.js';
import { dateRange, movementValue, productValue, RequestError } from '../../db/validation.js';

function json(data: unknown, status = 200) {
    return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function bodyValue(request: Request): Promise<Record<string, unknown>> {
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
        throw new RequestError(415, 'Envie o corpo no formato application/json');
    }
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        throw new RequestError(400, 'JSON inválido');
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new RequestError(400, 'Envie um objeto JSON');
    }
    return body as Record<string, unknown>;
}

export function createHandler(databaseFactory = createDatabase) {
    return async (request: Request): Promise<Response> => {
        let connection: ReturnType<typeof createDatabase> | undefined;
        const openDatabase = () => connection ??= databaseFactory();
        try {
            const url = new URL(request.url);
            const path = url.pathname.replace(/\/+$/, '') || '/';
            const methods: Record<string, string[]> = {
                '/api': ['GET'],
                '/produtos': ['GET', 'POST'],
                '/produtos/get': ['GET'],
                '/produtos/post': ['POST'],
                '/produtos/total-categoria': ['GET'],
                '/produtos/limites-estoque': ['GET'],
                '/movimentacoes/entrada': ['POST'],
                '/movimentacoes/saida': ['POST'],
                '/movimentacoes/saidas': ['GET'],
                '/movimentacoes/periodo': ['GET'],
                '/movimentacoes/maiores-saidas': ['GET'],
            };
            const allowed = methods[path];
            if (!allowed) return json({ erro: 'Rota não encontrada' }, 404);
            if (!allowed.includes(request.method)) {
                const response = json({ erro: 'Método não permitido' }, 405);
                response.headers.set('Allow', allowed.join(', '));
                return response;
            }
            if (path === '/api') return json({ status: 'ok', mensagem: 'API funcionando' });

            if (request.method === 'POST' && (path === '/produtos' || path === '/produtos/post')) {
                const product = productValue(await bodyValue(request));
                const database = openDatabase();
                const [created] = await database.insert(produtos).values(product).returning({ id: produtos.id });
                return json({ mensagem: 'Produto cadastrado', id: created.id }, 201);
            }

            if (path === '/movimentacoes/entrada' || path === '/movimentacoes/saida') {
                const movement = movementValue(await bodyValue(request));
                const incoming = path.endsWith('/entrada');
                const database = openDatabase();
                const created = await database.transaction(async (transaction) => {
                    const [product] = await transaction.select().from(produtos)
                        .where(eq(produtos.id, movement.produtos_id)).for('update');
                    if (!product) throw new RequestError(404, 'Produto não encontrado');
                    const stock = product.quantidade + (incoming ? movement.quantidade : -movement.quantidade);
                    if (stock < 0) throw new RequestError(400, 'Estoque insuficiente');
                    if (stock > 2147483647) throw new RequestError(400, 'Quantidade acima do limite permitido');
                    await transaction.update(produtos).set({ quantidade: stock })
                        .where(eq(produtos.id, movement.produtos_id));
                    const [inserted] = await transaction.insert(movimentacoes)
                        .values({ ...movement, tipo: incoming ? 'entrada' : 'saída' })
                        .returning({ id: movimentacoes.id });
                    return inserted;
                });
                return json({ mensagem: incoming ? 'Entrada registrada' : 'Saída registrada', id: created.id }, 201);
            }

            const period = path === '/movimentacoes/periodo' || path === '/movimentacoes/maiores-saidas'
                ? dateRange(url.searchParams) : undefined;
            const database = openDatabase();
            if (path === '/produtos' || path === '/produtos/get') {
                return json(await database.select().from(produtos).orderBy(produtos.id));
            }
            if (path === '/produtos/total-categoria') {
                return json(await database.select({
                    categoria: produtos.categoria,
                    valor_total: sql<string>`sum(${produtos.quantidade} * ${produtos.valor})`,
                }).from(produtos).groupBy(produtos.categoria).orderBy(produtos.categoria));
            }
            if (path === '/produtos/limites-estoque') {
                return json(await database.select({
                    id: produtos.id,
                    nome: produtos.nome,
                    quantidade: produtos.quantidade,
                    limite_atingido: sql<string>`case when ${produtos.quantidade} = 0 then 'mínimo' else 'máximo' end`,
                    percentual_nivel: produtos.quantidade,
                }).from(produtos).where(or(eq(produtos.quantidade, 0), eq(produtos.quantidade, 100))));
            }
            if (path === '/movimentacoes/saidas') {
                return json(await database.select({
                    id: movimentacoes.id,
                    data: movimentacoes.data,
                    tipo: movimentacoes.tipo,
                    quantidade: movimentacoes.quantidade,
                    produto: produtos.nome,
                }).from(movimentacoes).innerJoin(produtos, eq(produtos.id, movimentacoes.produtos_id))
                    .where(eq(movimentacoes.tipo, 'saída')).orderBy(desc(movimentacoes.data), desc(movimentacoes.id)));
            }
            if (period && path === '/movimentacoes/periodo') {
                return json(await database.select({
                    nome_produto: produtos.nome,
                    unidade_medida: produtos.unidade_medida,
                    total_entradas: sql<string>`sum(case when ${movimentacoes.tipo} = 'entrada' then ${movimentacoes.quantidade} else 0 end)`,
                    total_saidas: sql<string>`sum(case when ${movimentacoes.tipo} = 'saída' then ${movimentacoes.quantidade} else 0 end)`,
                    saldo_periodo: sql<string>`sum(case when ${movimentacoes.tipo} = 'entrada' then ${movimentacoes.quantidade} else -${movimentacoes.quantidade} end)`,
                    valor_entradas: sql<string>`sum(case when ${movimentacoes.tipo} = 'entrada' then ${movimentacoes.quantidade} * ${produtos.valor} else 0 end)`,
                    valor_saidas: sql<string>`sum(case when ${movimentacoes.tipo} = 'saída' then ${movimentacoes.quantidade} * ${produtos.valor} else 0 end)`,
                }).from(movimentacoes).innerJoin(produtos, eq(produtos.id, movimentacoes.produtos_id))
                    .where(between(movimentacoes.data, period.start, period.end))
                    .groupBy(produtos.id, produtos.nome, produtos.unidade_medida).orderBy(produtos.nome));
            }
            if (period) {
                const total = sql<string>`sum(${movimentacoes.quantidade})`;
                return json(await database.select({
                    produto: produtos.nome,
                    categoria: produtos.categoria,
                    total_saidas: total,
                }).from(movimentacoes).innerJoin(produtos, eq(produtos.id, movimentacoes.produtos_id))
                    .where(and(eq(movimentacoes.tipo, 'saída'), between(movimentacoes.data, period.start, period.end)))
                    .groupBy(produtos.id, produtos.nome, produtos.categoria).orderBy(desc(total)));
            }
            return json({ erro: 'Rota não encontrada' }, 404);
        } catch (error) {
            if (error instanceof RequestError) return json({ erro: error.message }, error.status);
            return json({ erro: 'Não foi possível concluir a operação. Tente novamente.' }, 500);
        } finally {
            if (connection) await connection.close().catch(() => {});
        }
    };
}

export default async function handler(request: Request) {
    return createHandler()(request);
}

export const config: Config = {
    path: ['/api', '/api/', '/produtos', '/produtos/*', '/movimentacoes/*'],
};
