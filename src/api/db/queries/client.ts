import { and, desc, eq, gte, lte, or, sql } from "drizzle-orm";

import type { TransactionType } from "@/api/db";
import type { NewClient } from "@/api/db/schema";

import { getDB } from "@/api/db";
import { clients } from "@/api/db/schema";

export async function create(data: NewClient, tx?: TransactionType) {
    const [client] = await getDB(tx).insert(clients).values(data).returning();

    return client ?? null;
}

export async function update(data: Partial<NewClient> & { id: number }, tx?: TransactionType) {
    const [client] = await getDB(tx).update(clients).set(data).where(eq(clients.id, data.id)).returning();

    return client ?? null;
}

export async function remove(id: number, tx?: TransactionType) {
    const [client] = await getDB(tx).delete(clients).where(eq(clients.id, id)).returning();

    return client ?? null;
}

export async function findOne_And(data: { id?: number; email?: string; pan?: string; mobile?: string }, tx?: TransactionType) {
    const conditions = [];
    if (data.id)
        conditions.push(eq(clients.id, data.id));
    if (data.email)
        conditions.push(eq(clients.email, data.email));
    if (data.pan)
        conditions.push(eq(clients.pan, data.pan));
    if (data.mobile)
        conditions.push(eq(clients.mobile, data.mobile));

    if (conditions.length === 0)
        return null;

    return getDB(tx).query.clients.findFirst({
        where: and(...conditions),
    });
}

export async function findOne_Or(data: { id?: number; email?: string; pan?: string; mobile?: string }, tx?: TransactionType) {
    const conditions = [];
    if (data.id)
        conditions.push(eq(clients.id, data.id));
    if (data.email)
        conditions.push(eq(clients.email, data.email));
    if (data.pan)
        conditions.push(eq(clients.pan, data.pan));
    if (data.mobile)
        conditions.push(eq(clients.mobile, data.mobile));

    if (conditions.length === 0)
        return null;

    return getDB(tx).query.clients.findFirst({
        where: or(...conditions),
    });
}

export async function findAllWithPagination(data: { page: number; limit: number; search?: string; id?: number }, tx?: TransactionType) {
    const conditions = [];
    if (data.id)
        conditions.push(eq(clients.id, data.id));
    if (data.search) {
        const searchTerm = `%${data.search}%`;
        conditions.push(or(
            eq(clients.name, searchTerm),
            eq(clients.email, searchTerm),
            eq(clients.pan, searchTerm),
            eq(clients.mobile, searchTerm),
        ));
    }

    if (conditions.length === 0)
        return { clients: [], count: 0 };

    const clientsData = await getDB(tx).query.clients.findMany({
        where: and(...conditions),
        orderBy: [desc(clients.createdAt)],
        limit: data.limit,
        offset: (data.page - 1) * data.limit,
    });

    const clientCount = await getDB(tx)
        .select({ count: sql<number>`count(*)` })
        .from(clients)
        .where(and(...conditions));

    return { clients: clientsData, count: clientCount && clientCount.length > 0 ? clientCount[0].count : 0 };
}

export async function calculateTotalClient(data: { from?: number; to?: number }, tx?: TransactionType) {
    const conditions = [];

    if (data.from)
        conditions.push(gte(clients.createdAt, data.from));
    if (data.to)
        conditions.push(lte(clients.createdAt, data.to));

    const totalClient = await getDB(tx)
        .select({ count: sql<number>`count(*)` })
        .from(clients)
        .where(and(...conditions));

    return totalClient && totalClient.length > 0 ? totalClient[0].count : 0;
}
