declare module 'pdf-parse' {
  export interface PDFData {
    text: string;
    numpages: number;
    info: Record<string, any>;
    metadata: Record<string, any>;
    version: string;
  }

  function pdf(dataBuffer: Buffer, options?: Record<string, any>): Promise<PDFData>;
  
  export default pdf;
} 