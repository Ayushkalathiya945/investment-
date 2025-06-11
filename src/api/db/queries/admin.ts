import { eq } from "drizzle-orm";

import type { TransactionType } from "@/api/db";
import type { NewAdmin } from "@/api/db/schema";

import { getDB } from "@/api/db";
import { admins } from "@/api/db/schema";

export async function create(data: NewAdmin, tx?: TransactionType) {
    const [admin] = await getDB(tx).insert(admins).values(data).returning();

    return admin ?? null;
}

export async function update(data: Partial<NewAdmin>, tx?: TransactionType) {
    const [admin] = await getDB(tx).update(admins).set(data).returning();

    return admin ?? null;
}

export async function remove(id: number, tx?: TransactionType) {
    const [admin] = await getDB(tx).delete(admins).where(eq(admins.id, id)).returning();

    return admin ?? null;
}

export async function findOne(data: { username: string }, tx?: TransactionType) {
    return getDB(tx).query.admins.findFirst({
        where: eq(admins.username, data.username),
    });
}
