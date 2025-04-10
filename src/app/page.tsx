'use client';

import { useState } from 'react';
import axios from 'axios';

interface TableData {
  [key: string]: string;
}

export default function Home() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [fileType, setFileType] = useState<string>('');
  const [tableData, setTableData] = useState<TableData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [showAll, setShowAll] = useState<boolean>(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const formData = new FormData();
    formData.append('file', file);
    
    setIsLoading(true);
    setError('');
    setFileType('');
    setTableData([]);
    setHeaders([]);
    setShowAll(false);
    
    try {
      console.log(`Uploading file: ${file.name}, size: ${file.size} bytes, type: ${file.type}`);
      
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      const { fileType, tableData, headers } = response.data;
      console.log(`File processed successfully. Detected type: ${fileType}`);
      console.log(`Received ${tableData.length} rows of data with ${headers.length} columns`);
      
      setFileType(fileType);
      setTableData(tableData);
      setHeaders(headers);
    } catch (error) {
      console.error('Error uploading file:', error);
      
      let errorMessage = 'An error occurred while processing the file';
      
      if (axios.isAxiosError(error) && error.response) {
        console.error('Server error details:', error.response.data);
        // Get detailed error message from the server response if available
        if (error.response.data && error.response.data.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.status === 400) {
          errorMessage = 'Bad request: The file could not be processed. Please check the file format.';
        } else if (error.response.status === 413) {
          errorMessage = 'The file is too large. Please upload a smaller file.';
        } else if (error.response.status === 500) {
          errorMessage = 'Server error: The server encountered an error while processing the file.';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Determine if we should show a single large form or multiple small forms
  const shouldShowSingleForm = tableData.length === 1 && headers.length > 4;
  const visibleRows = showAll ? tableData : tableData.slice(0, 9);
  const hasMoreRows = tableData.length > 9 && !showAll;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6 text-center">Table Extraction &amp; Form Generator</h1>
      
      <div className="mb-8 text-center max-w-2xl mx-auto bg-blue-50 p-4 rounded-lg">
        <p className="text-sm text-gray-700 mb-3">
          Upload any tabular document and the system will automatically extract the data and generate forms
          for each row. The column headers will be used as form field labels.
        </p>
        <p className="text-xs text-gray-600">
          Supported formats: Excel (.xlsx, .xls), CSV, PDF with tables, Word documents (.docx), and plain text files.
        </p>
      </div>
      
      <div className="flex flex-col items-center mb-8">
        <label 
          htmlFor="file-upload" 
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg cursor-pointer shadow-md transition-colors text-lg flex items-center justify-center mb-4"
        >
          <span>{isLoading ? 'Processing...' : 'Insert Table Document'}</span>
          <input
            id="file-upload"
            type="file"
            accept=".xlsx,.xls,.csv,.pdf,.docx,.doc,.txt,.tsv"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isLoading}
          />
        </label>
        <p className="text-sm text-gray-600 mb-2">System will generate a form for each row in the detected table</p>
        {error && <p className="text-red-500 mt-3 text-center max-w-md p-3 bg-red-50 rounded-lg">{error}</p>}
        {fileType && <p className="text-green-600 mt-2">Detected file type: {fileType}</p>}
        {isLoading && (
          <div className="mt-4 text-blue-600 animate-pulse">
            <p>Analyzing file and extracting tables...</p>
          </div>
        )}
      </div>
      
      {headers.length > 0 && tableData.length > 0 && (
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">
              {shouldShowSingleForm 
                ? 'Extracted Form Data' 
                : `Generated Forms (${tableData.length})`}
            </h2>
            {tableData.length > 1 && (
              <div className="text-sm text-gray-500">
                {shouldShowSingleForm 
                  ? 'Displaying as single form due to large number of fields' 
                  : `Each form represents a row from the extracted table`}
              </div>
            )}
          </div>
          
          {shouldShowSingleForm ? (
            // Display single form with many fields for single row with many columns
            <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
              <form className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {headers.map((header) => (
                  <div key={header} className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700">
                      {header}
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      defaultValue={tableData[0][header] || ''}
                    />
                  </div>
                ))}
              </form>
            </div>
          ) : (
            // Display multiple forms for multiple rows
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {visibleRows.map((row, rowIndex) => (
                <div 
                  key={rowIndex} 
                  className="bg-white p-6 rounded-lg shadow-md border border-gray-200"
                >
                  <h3 className="text-lg font-semibold mb-4 pb-2 border-b border-gray-200">
                    Form {rowIndex + 1}
                  </h3>
                  
                  <form className="space-y-4">
                    {headers.map((header) => (
                      <div key={header} className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">
                          {header}
                        </label>
                        <input
                          type="text"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          defaultValue={row[header] || ''}
                        />
                      </div>
                    ))}
                  </form>
                </div>
              ))}
            </div>
          )}
          
          {hasMoreRows && (
            <div className="text-center mt-6">
              <p className="text-gray-600 mb-2">
                Showing 9 of {tableData.length} forms
              </p>
              <button
                onClick={() => setShowAll(true)}
                className="bg-blue-100 hover:bg-blue-200 text-blue-800 font-semibold py-2 px-4 rounded-md transition-colors"
              >
                Show All Forms
              </button>
            </div>
          )}
          
          {showAll && tableData.length > 9 && (
            <div className="text-center mt-6">
              <button
                onClick={() => setShowAll(false)}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-md transition-colors"
              >
                Show Less
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
