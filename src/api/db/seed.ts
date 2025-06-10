/* eslint-disable no-console */
import bcrypt from "bcryptjs";

import { db } from "@/api/db/index";
import { admins, Exchange, stocks } from "@/api/db/schema";

// This script seeds the database with initial data
async function seedDatabase() {
    console.log("Seeding database...");

    try {
    // Create admin user
        const hashedPassword = await bcrypt.hash("admin123", 10);
        await db.insert(admins).values({
            username: "admin",
            password: hashedPassword,
        }).onConflictDoNothing();

        console.log("Admin user created");

        // Seed some sample Indian stocks
        const sampleStocks = [
            {
                symbol: "RELIANCE",
                name: "Reliance Industries Ltd",
                exchange: Exchange.NSE,
                isin: "INE002A01018",
                sector: "Energy",
                currentPrice: 2500.50,
            },
            {
                symbol: "TCS",
                name: "Tata Consultancy Services Ltd",
                exchange: Exchange.NSE,
                isin: "INE467B01029",
                sector: "Information Technology",
                currentPrice: 3450.75,
            },
            {
                symbol: "HDFCBANK",
                name: "HDFC Bank Ltd",
                exchange: Exchange.NSE,
                isin: "INE040A01034",
                sector: "Banking",
                currentPrice: 1650.25,
            },
            {
                symbol: "INFY",
                name: "Infosys Ltd",
                exchange: Exchange.NSE,
                isin: "INE009A01021",
                sector: "Information Technology",
                currentPrice: 1480.60,
            },
            {
                symbol: "ICICIBANK",
                name: "ICICI Bank Ltd",
                exchange: Exchange.NSE,
                isin: "INE090A01021",
                sector: "Banking",
                currentPrice: 950.30,
            },
        ];

        for (const stock of sampleStocks) {
            await db.insert(stocks).values({
                ...stock,
            }).onConflictDoNothing();
        }

        console.log("Sample stocks created");
        console.log("Database seeding completed successfully");
    } catch (error) {
        console.error("Database seeding failed:", error);
        process.exit(1);
    }
}

seedDatabase();
