// src/app/api/sync-cookies/route.js
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(request) {
  try {
    const { cookies } = await request.json();
    const cookiesDir = path.join(process.cwd(), 'cookies');
    
    if (!fs.existsSync(cookiesDir)) {
      fs.mkdirSync(cookiesDir, { recursive: true });
    }

    // 1. Get current files in the directory
    const existingFiles = fs.readdirSync(cookiesDir);
    const existingNamesMap = new Map(); // name -> filename
    for (const file of existingFiles) {
      if (file.endsWith('.json') || file.endsWith('.txt')) {
        const name = file.replace(/\.[^/.]+$/, "");
        existingNamesMap.set(name, file);
      }
    }

    // 2. Keep track of files we should keep
    const filesToKeep = new Set();

    // 3. Write/update files from the requested cookies list
    for (const cookie of cookies) {
      // Clean name to be a safe filename, but preserve spaces/alphanumerics
      const safeName = cookie.name.trim().replace(/[^a-zA-Z0-9_\-\s]/g, "");
      if (!safeName) continue;

      // Always save as .json file containing parsed cookie dictionary
      const filename = `${safeName}.json`;
      const filePath = path.join(cookiesDir, filename);
      
      const jsonContent = JSON.stringify(cookie.parsed || {}, null, 2);
      fs.writeFileSync(filePath, jsonContent, 'utf-8');
      filesToKeep.add(filename);
    }

    // 4. Delete files that are no longer in the list
    for (const file of existingFiles) {
      if ((file.endsWith('.json') || file.endsWith('.txt')) && !filesToKeep.has(file)) {
        const filePath = path.join(cookiesDir, file);
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.error(`Failed to delete file ${file}:`, err);
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to sync cookies to folder:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
