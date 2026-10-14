export class RequestError extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

export function integerValue(value: unknown, minimum = 0): number {
    if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') {
        throw new RequestError(400, 'Informe uma quantidade ou identificador inteiro válido');
    }
    const result = Number(value);
    if (!Number.isInteger(result) || result < minimum || result > 2147483647) {
        throw new RequestError(400, 'Quantidade ou identificador fora do intervalo permitido');
    }
    return result;
}

export function dateValue(value: unknown): string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) {
        throw new RequestError(400, 'Informe uma data válida no formato AAAA-MM-DD');
    }
    const parsed = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        throw new RequestError(400, 'Informe uma data válida');
    }
    return value;
}

export function dateRange(parameters: URLSearchParams) {
    const start = dateValue(parameters.get('dataInicial'));
    const end = dateValue(parameters.get('dataFinal'));
    if (start > end) throw new RequestError(400, 'A data inicial deve ser anterior ou igual à data final');
    return { start, end };
}

function textValue(value: unknown, maximum: number, field: string): string {
    if (typeof value !== 'string' || !value.trim() || [...value].length > maximum) {
        throw new RequestError(400, `Informe ${field} com até ${maximum} caracteres`);
    }
    return value;
}

export function productValue(body: Record<string, unknown>) {
    const value = body.valor;
    if ((typeof value !== 'number' && typeof value !== 'string') ||
        !/^\d{1,8}(\.\d{1,2})?$/.test(String(value)) || Number(value) <= 0) {
        throw new RequestError(400, 'O valor deve ser positivo e ter até duas casas decimais');
    }
    return {
        nome: textValue(body.nome, 255, 'nome'),
        categoria: textValue(body.categoria, 255, 'categoria'),
        unidade_medida: textValue(body.unidade_medida, 30, 'unidade_medida'),
        valor: String(value),
        quantidade: integerValue(body.quantidade),
    };
}

export function movementValue(body: Record<string, unknown>) {
    return {
        produtos_id: integerValue(body.produtos_id, 1),
        quantidade: integerValue(body.quantidade, 1),
        data: dateValue(body.data),
    };
}
