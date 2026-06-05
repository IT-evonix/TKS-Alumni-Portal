/**
 * Helper functions to transform data between database snake_case and frontend camelCase
 */

/**
 * Convert snake_case to camelCase
 */
export function toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase to snake_case
 */
export function toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/**
 * Transform object keys from snake_case to camelCase
 */
export function transformToCamelCase<T = any>(obj: any): T {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => transformToCamelCase(item)) as any;
    }

    if (typeof obj !== 'object') {
        return obj;
    }

    const result: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const camelKey = toCamelCase(key);
            result[camelKey] = transformToCamelCase(obj[key]);
        }
    }
    return result;
}

/**
 * Transform object keys from camelCase to snake_case
 */
export function transformToSnakeCase<T = any>(obj: any): T {
    if (obj === null || obj === undefined) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => transformToSnakeCase(item)) as any;
    }

    if (typeof obj !== 'object') {
        return obj;
    }

    const result: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const snakeKey = toSnakeCase(key);
            result[snakeKey] = transformToSnakeCase(obj[key]);
        }
    }
    return result;
}
