import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import formidable from 'formidable';
import * as fileType from 'file-type';
import * as XLSX from 'xlsx';
import { extractDocxTables } from '@/utils/docxParser';
import mime from 'mime-types';

// Disable default body parser to handle file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

// Function to detect file type
const detectFileType = async (filePath: string): Promise<string | null> => {
  try {
    // Use fileType library to detect file type from magic bytes
    const type = await fileType.fileTypeFromFile(filePath);
    if (type) return type.mime;
    
    // If fileType fails, try using mime-types
    const mimeType = mime.lookup(filePath);
    if (mimeType) return mimeType as string;
    
    return null;
  } catch (error) {
    console.error('Error detecting file type:', error);
    return null;
  }
};

// Check if the file is a supported type for table extraction
const isSupportedTableFormat = (mimeType: string): boolean => {
  // Supported table formats
  const supportedFormats = [
    // Excel
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel.sheet.macroEnabled.12',
    'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
    
    // CSV
    'text/csv',
    'text/comma-separated-values',
    
    // TSV
    'text/tab-separated-values',
    
    // PDF
    'application/pdf',
    
    // Word
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    
    // Text (potentially containing tabular data)
    'text/plain'
  ];
  
  // Check if mimetype is in supported formats or has a general match
  return supportedFormats.some(format => mimeType.includes(format));
};

// Function to extract table data from various file types
const extractTableData = async (filePath: string, mimeType: string): Promise<Record<string, string>[]> => {
  try {
    console.log(`Extracting data from file type: ${mimeType}`);
    
    // Skip image files or other non-supported formats
    if (!isSupportedTableFormat(mimeType)) {
      console.log(`Unsupported file type for table extraction: ${mimeType}`);
      return [];
    }
    
    if (mimeType.includes('spreadsheetml') || mimeType.includes('excel') || mimeType.includes('xlsx') || mimeType.includes('xls')) {
      // Excel file
      console.log('Processing as Excel file');
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, string>[];
      console.log(`Excel data extracted: ${data.length} rows`);
      return data;
    } 
    else if (mimeType.includes('csv')) {
      // CSV file
      console.log('Processing as CSV file');
      const content = await fs.readFile(filePath, 'utf-8');
      const workbook = XLSX.read(content, { type: 'string' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, string>[];
      console.log(`CSV data extracted: ${data.length} rows`);
      return data;
    } 
    else if (mimeType.includes('pdf')) {
      // PDF file
      console.log('Processing as PDF file');
      const dataBuffer = await fs.readFile(filePath);
      // Dynamic import of pdf-parse to avoid initialization errors
      const pdfParse = (await import('pdf-parse')).default;
      const data = await pdfParse(dataBuffer);
      console.log(`PDF text extracted, length: ${data.text.length} characters`);
      
      // Note: This is a very basic implementation
      // In a real-world application, you would need a more robust PDF table extraction library
      const lines = data.text.split('\n').filter((line: string) => line.trim() !== '');
      console.log(`PDF lines found: ${lines.length}`);
      
      // Try multiple approaches to detect tables in PDF
      
      // Approach 1: Try to identify tables with consistent spacing/formatting
      if (lines.length > 1) {
        // Look for potential table patterns in the first few lines
        const potentialHeaderLines = lines.slice(0, Math.min(5, lines.length));
        let bestHeaderLine = 0;
        let bestDelimiter: 'space' | 'comma' | 'tab' = 'space';
        let bestHeaderCount = 0;
        
        // Find the line that likely contains headers by looking for consistent delimiters
        for (let i = 0; i < potentialHeaderLines.length; i++) {
          const line = potentialHeaderLines[i];
          
          // Try space-based columns
          if (line.includes('  ')) {
            const spaceHeaders = line.split(/\s{2,}/).map(h => h.trim()).filter(h => h !== '');
            if (spaceHeaders.length > bestHeaderCount) {
              bestHeaderCount = spaceHeaders.length;
              bestHeaderLine = i;
              bestDelimiter = 'space';
            }
          }
          
          // Try comma-based columns
          if (line.includes(',')) {
            const commaHeaders = line.split(',').map(h => h.trim()).filter(h => h !== '');
            if (commaHeaders.length > bestHeaderCount) {
              bestHeaderCount = commaHeaders.length;
              bestHeaderLine = i;
              bestDelimiter = 'comma';
            }
          }
          
          // Try tab-based columns
          if (line.includes('\t')) {
            const tabHeaders = line.split('\t').map(h => h.trim()).filter(h => h !== '');
            if (tabHeaders.length > bestHeaderCount) {
              bestHeaderCount = tabHeaders.length;
              bestHeaderLine = i;
              bestDelimiter = 'tab';
            }
          }
        }
        
        // Check if we found a promising header structure
        if (bestHeaderCount >= 2) {
          console.log(`Found potential table with ${bestHeaderCount} columns using ${bestDelimiter} delimiter at line ${bestHeaderLine}`);
          
          // Extract headers based on the best delimiter found
          const headerLine = lines[bestHeaderLine];
          const headers = bestDelimiter === 'space' 
            ? headerLine.split(/\s{2,}/).map(h => h.trim()).filter(h => h !== '')
            : bestDelimiter === 'comma'
              ? headerLine.split(',').map(h => h.trim()).filter(h => h !== '')
              : headerLine.split('\t').map(h => h.trim()).filter(h => h !== '');
          
          console.log(`Headers detected: ${headers.join(', ')}`);
          
          // Process data rows below the header line
          const rows: Record<string, string>[] = [];
          
          for (let i = bestHeaderLine + 1; i < lines.length; i++) {
            const dataLine = lines[i];
            const values = bestDelimiter === 'space'
              ? dataLine.split(/\s{2,}/).map(v => v.trim()).filter(v => v !== '')
              : bestDelimiter === 'comma'
                ? dataLine.split(',').map(v => v.trim())
                : dataLine.split('\t').map(v => v.trim());
            
            // Only create row if we have enough values that roughly match header count
            // Allow some flexibility in column count for PDFs where extraction might be imperfect
            if (values.length >= Math.max(2, headers.length - 1) && values.length <= headers.length + 1) {
              const row: Record<string, string> = {};
              
              // Assign values to headers, being careful with indexes
              for (let j = 0; j < Math.min(headers.length, values.length); j++) {
                row[headers[j]] = values[j];
              }
              
              rows.push(row);
            }
          }
          
          console.log(`Extracted ${rows.length} rows from PDF using ${bestDelimiter} separation`);
          
          if (rows.length > 0) {
            return rows;
          }
        }
        
        // Approach 2: If we couldn't find a clear table structure,
        // Try to create a table from lines with similar structure
        console.log('Attempting to detect table structure from line patterns');
        
        // First, try to detect if each line might represent a record
        // Look for consistent pattern of line lengths
        const wordCountMap = new Map<number, number>();
        lines.forEach(line => {
          const wordCount = line.split(/\s+/).length;
          wordCountMap.set(wordCount, (wordCountMap.get(wordCount) || 0) + 1);
        });
        
        // Find the most common word count (potential table rows)
        let mostCommonWordCount = 0;
        let highestFrequency = 0;
        
        wordCountMap.forEach((frequency, wordCount) => {
          if (frequency > highestFrequency && wordCount > 1) {
            highestFrequency = frequency;
            mostCommonWordCount = wordCount;
          }
        });
        
        // If we have a strong pattern (at least 3 lines with the same structure)
        if (highestFrequency >= 3 && mostCommonWordCount >= 2) {
          console.log(`Detected potential table pattern with ${mostCommonWordCount} fields per line`);
          
          // Generate generic headers (Column1, Column2, etc.)
          const genericHeaders = Array.from({ length: mostCommonWordCount }, (_, i) => `Column${i+1}`);
          
          // Create rows from lines that match the pattern
          const patternRows: Record<string, string>[] = [];
          
          lines.forEach(line => {
            const words = line.split(/\s+/);
            if (words.length === mostCommonWordCount) {
              const row: Record<string, string> = {};
              words.forEach((word, index) => {
                row[genericHeaders[index]] = word;
              });
              patternRows.push(row);
            }
          });
          
          console.log(`Created ${patternRows.length} rows based on pattern detection`);
          
          if (patternRows.length > 0) {
            return patternRows;
          }
        }
      }
      
      // No table was found
      console.log('No table structure found in PDF');
      return [];
    } 
    else if (mimeType.includes('docx') || mimeType.includes('word')) {
      // Word document
      console.log('Processing as Word document');
      const data = await extractDocxTables(filePath);
      console.log(`Word document data extracted: ${data.length} rows`);
      return data;
    } 
    else if (mimeType.includes('text/plain') || mimeType.includes('tsv')) {
      // Plain text or TSV file
      console.log('Processing as plain text or TSV file');
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').filter(line => line.trim() !== '');
      console.log(`Text file lines: ${lines.length}`);
      
      if (lines.length > 1) {
        // Try to detect the delimiter (tab, comma, or other)
        const firstLine = lines[0];
        let delimiter: string | RegExp = '\t'; // Default to tab
        
        if (firstLine.includes('\t')) {
          console.log('Tab delimiter detected');
          delimiter = '\t';
        } else if (firstLine.includes(',')) {
          console.log('Comma delimiter detected');
          delimiter = ',';
        } else if (firstLine.includes(';')) {
          console.log('Semicolon delimiter detected');
          delimiter = ';';
        } else {
          console.log('No common delimiter found, defaulting to space');
          delimiter = /\s+/;
        }
        
        const headers = typeof delimiter === 'string' 
          ? firstLine.split(delimiter).map(h => h.trim())
          : firstLine.split(delimiter).filter(h => h.trim() !== '');
          
        console.log(`Headers detected: ${headers.join(', ')}`);
        
        const rows: Record<string, string>[] = [];
        for (let i = 1; i < lines.length; i++) {
          const values = typeof delimiter === 'string'
            ? lines[i].split(delimiter).map(v => v.trim())
            : lines[i].split(delimiter).filter(v => v.trim() !== '');
            
          if (values.length === headers.length) {
            const row: Record<string, string> = {};
            headers.forEach((header, index) => {
              row[header] = values[index];
            });
            rows.push(row);
          }
        }
        console.log(`Extracted ${rows.length} rows from text file`);
        return rows;
      }
      
      // No table structure
      console.log('No table structure found in text file');
      return [];
    } else {
      console.log(`Unsupported file type: ${mimeType} for table extraction`);
      return [];
    }
    
  } catch (error) {
    console.error('Error extracting table data:', error);
    return [];
  }
};

export async function POST(req: NextRequest) {
  try {
    console.log('File upload request received');
    // Get the FormData from the request - App Router way
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      console.error('No file found in request');
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    console.log(`File received: ${file.name}, size: ${file.size} bytes`);
    
    // Create a temporary file to store the uploaded file
    const tempDir = path.join(os.tmpdir(), 'uploads');
    await fs.mkdir(tempDir, { recursive: true });
    const tempFilePath = path.join(tempDir, 'upload-' + Date.now() + '-' + file.name);
    
    // Write the file to the temporary location
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(tempFilePath, buffer);
    console.log(`File saved to temporary location: ${tempFilePath}`);
    
    // Detect file type
    const mimeType = await detectFileType(tempFilePath) || 'application/octet-stream';
    console.log(`Detected MIME type: ${mimeType}`);
    
    // Check if it's a supported format for table extraction
    if (!isSupportedTableFormat(mimeType)) {
      console.error(`Unsupported file type for table extraction: ${mimeType}`);
      await fs.unlink(tempFilePath);
      return NextResponse.json(
        { error: 'This file type is not supported for table extraction. Please upload Excel, CSV, PDF or other tabular documents.' },
        { status: 400 }
      );
    }
    
    // Check if it's an image - we don't want to process images
    if (mimeType.startsWith('image/')) {
      console.error('Image files are not supported for table extraction');
      await fs.unlink(tempFilePath);
      return NextResponse.json(
        { error: 'Image files cannot be used for table extraction. Please upload Excel, CSV, PDF or other tabular documents.' },
        { status: 400 }
      );
    }
    
    // Extract table data
    const tableData = await extractTableData(tempFilePath, mimeType);
    
    // Clean up temporary file
    await fs.unlink(tempFilePath);
    console.log('Temporary file cleaned up');
    
    if (tableData.length === 0) {
      console.error('No table data found in the file');
      return NextResponse.json(
        { error: 'No table data found in the file. Please upload a file containing structured data in a table format.' },
        { status: 400 }
      );
    }
    
    // Return the extracted table data
    console.log(`Returning ${tableData.length} rows of data with ${Object.keys(tableData[0]).length} columns`);
    return NextResponse.json({
      success: true,
      fileType: mimeType,
      tableData: tableData,
      headers: Object.keys(tableData[0])
    });
  } catch (error) {
    console.error('Error processing file:', error);
    return NextResponse.json(
      { error: 'Failed to process the file: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
} 