import { config } from "dotenv";
import { writeFileSync } from "fs";
import { join } from "path";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";

// Load environment variables FIRST
config();

// Create database connection directly
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined. Make sure you have a .env file with DATABASE_URL set.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

async function exportAvatarPrompts() {
  try {
    console.log("📥 Fetching avatars from database...");
    
    // Get all avatars
    const allAvatars = await db.select().from(schema.avatars);

    if (allAvatars.length === 0) {
      console.log("⚠️  No avatars found in database");
      process.exit(0);
    }

    console.log(`📊 Found ${allAvatars.length} avatars`);

    // Extract prompts and format them to match the original structure
    const promptsArray = allAvatars.map((avatar) => ({
      prompt: avatar.prompt,
    }));

    // Generate TypeScript file content with proper formatting
    // Match the original format: each item has { prompt: {...} }
    const jsonString = JSON.stringify(promptsArray, null, 4);
    
    // Indent each line with 4 spaces to match the original format
    const indentedJson = jsonString
      .split("\n")
      .map((line, index) => {
        if (index === 0) return line; // First line (opening bracket)
        return "    " + line; // Indent all other lines
      })
      .join("\n");

    const fileContent = `export const avatarPrompts = ${indentedJson};
`;

    // Write to avatarPrompts.ts
    const filePath = join(process.cwd(), "avatarPrompts.ts");
    writeFileSync(filePath, fileContent, "utf-8");

    console.log(`✅ Successfully exported ${promptsArray.length} prompts to avatarPrompts.ts`);
    console.log(`📁 File location: ${filePath}`);
  } catch (error) {
    console.error("❌ Error exporting prompts:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Stack:", error.stack);
    }
    process.exit(1);
  } finally {
    // Close database connection
    await pool.end();
    process.exit(0);
  }
}

exportAvatarPrompts();

