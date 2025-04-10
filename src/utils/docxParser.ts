import { readFile } from 'fs/promises';

/**
 * Extracts tables from DOCX files
 * @param filePath Path to the DOCX file
 * @returns Array of table data
 */
export async function extractDocxTables(filePath: string): Promise<any[]> {
  try {
    // Read the file
    const buffer = await readFile(filePath);
    
    // Dynamically import mammoth to avoid initialization issues
    const mammoth = await import('mammoth');
    
    // Convert DOCX to HTML
    const result = await mammoth.convertToHtml({ buffer });
    const html = result.value;
    
    // Use regex to extract table data from HTML
    // This is a simple implementation - in a real-world app, you might want to use a DOM parser
    const tables: any[] = [];
    
    // Find all tables in the HTML
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
    const tableMatches = html.match(tableRegex);
    
    if (!tableMatches) return [];
    
    for (const tableHtml of tableMatches) {
      // Find all rows
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      const rowMatches = tableHtml.match(rowRegex);
      
      if (!rowMatches || rowMatches.length < 2) continue; // Need at least header and one data row
      
      // Extract headers
      const headerRegex = /<th[^>]*>([\s\S]*?)<\/th>|<td[^>]*>([\s\S]*?)<\/td>/gi;
      const headerRow = rowMatches[0];
      const headerMatches = [...headerRow.matchAll(headerRegex)];
      
      if (!headerMatches || headerMatches.length === 0) continue;
      
      const headers = headerMatches.map(match => {
        const content = match[1] || match[2];
        return content.replace(/<[^>]*>/g, '').trim();
      });
      
      // Process data rows
      const rows: any[] = [];
      
      for (let i = 1; i < rowMatches.length; i++) {
        const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
        const cellMatches = [...rowMatches[i].matchAll(cellRegex)];
        
        if (cellMatches.length !== headers.length) continue;
        
        const row: Record<string, string> = {};
        
        cellMatches.forEach((match, index) => {
          const content = match[1];
          const cleanContent = content.replace(/<[^>]*>/g, '').trim();
          row[headers[index]] = cleanContent;
        });
        
        rows.push(row);
      }
      
      if (rows.length > 0) {
        tables.push(...rows);
      }
    }
    
    return tables;
  } catch (error) {
    console.error('Error extracting tables from DOCX:', error);
    return [];
  }
} 