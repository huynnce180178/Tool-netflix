// src/app/api/init-cookies/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const cookiesDir = path.join(process.cwd(), 'cookies');
    if (!fs.existsSync(cookiesDir)) {
      return NextResponse.json({ cookies: [] });
    }

    const files = fs.readdirSync(cookiesDir);
    const cookies = [];

    for (const file of files) {
      if (file.endsWith('.json') || file.endsWith('.txt')) {
        const filePath = path.join(cookiesDir, file);
        const rawContent = fs.readFileSync(filePath, 'utf-8');
        const name = file.replace(/\.[^/.]+$/, "");
        cookies.push({
          name,
          raw: rawContent
        });
      }
    }

    return NextResponse.json({ cookies });
  } catch (error) {
    console.error("Failed to read cookies directory:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
