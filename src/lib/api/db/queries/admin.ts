import { eq } from "drizzle-orm";

import type { TransactionType } from "../../db";
import type { NewAdmin } from "../schema";

import { getDB } from "../../db";
import { admins } from "../schema";

export async function create(data: NewAdmin, tx?: TransactionType) {
    const [admin] = await getDB(tx).insert(admins).values(data).returning();

    return admin ?? null;
}

export async function update(data: Partial<NewAdmin> & { id: number }, tx?: TransactionType) {
    const [admin] = await getDB(tx).update(admins).set(data).where(eq(admins.id, data.id)).returning();

    return admin ?? null;
}

export async function remove(id: number, tx?: TransactionType) {
    const [admin] = await getDB(tx).delete(admins).where(eq(admins.id, id)).returning();

    return admin ?? null;
}

export async function findOne(data: { email: string }, tx?: TransactionType) {
    return getDB(tx).query.admins.findFirst({
        where: eq(admins.email, data.email),
    });
}
