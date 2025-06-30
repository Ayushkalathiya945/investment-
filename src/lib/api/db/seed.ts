import bcrypt from "bcryptjs";

import { db } from "./index";
import { admins } from "./schema";

// This script seeds the database with initial data
async function seedDatabase() {
    // console.log("Seeding database...");

    try {
    // Create admin user
        const hashedPassword = await bcrypt.hash("admin123", 10);
        await db.insert(admins).values({
            email: "admin@gmail.com",
            password: hashedPassword,
        }).onConflictDoNothing();

        // console.log("Admin user created");
        // console.log("Database seeding completed successfully");
    } catch (error) {
        console.error("Database seeding failed:", error);
        process.exit(1);
    }
}

seedDatabase();
