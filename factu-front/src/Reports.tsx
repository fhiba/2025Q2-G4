'use client';

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiService } from './services/apiService';
import { useAuth } from "./hooks/useAuth";

interface Invoice {
  file_key: string;
  filename: string;
}

interface ExtractedData {
  total?: string | null;
  fecha?: string | null;
  cuit?: string | null;
  proveedor?: string | null;
  text_length?: number | null;
  file_size?: number | null;
}

const Reports = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expandedInvoice, setExpandedInvoice] = useState<string | null>(null);
  const [invoiceData, setInvoiceData] = useState<{ [key: string]: ExtractedData }>({});
  const [loadingData, setLoadingData] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const navigate = useNavigate();
  const auth = useAuth();

  // Fetch list of invoices (file_key and filename)
  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = auth.getAccessToken();
      if (!token) throw new Error('No auth token');
      
      const data = await ApiService.fetchInvoices(token);
      setInvoices(Array.isArray(data.facturas) ? data.facturas : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoices');
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch extracted data for a specific invoice
  const fetchInvoiceData = async (fileKey: string) => {
    setLoadingData(prev => ({ ...prev, [fileKey]: true }));
    try {
      const token = auth.getAccessToken();
      if (!token) throw new Error('No auth token');
      
      const response = await ApiService.fetchReportForInvoice(token, fileKey);
      setInvoiceData(prev => ({ ...prev, [fileKey]: response.data || {} }));
    } catch (err) {
      console.error('Error fetching invoice data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch invoice data');
    } finally {
      setLoadingData(prev => ({ ...prev, [fileKey]: false }));
    }
  };

  // Handle invoice expansion/collapse
  const handleToggleInvoice = async (fileKey: string) => {
    if (expandedInvoice === fileKey) {
      setExpandedInvoice(null);
    } else {
      setExpandedInvoice(fileKey);
      if (!invoiceData[fileKey]) {
        await fetchInvoiceData(fileKey);
      }
    }
  };

  // Export invoices to CSV
  const handleExportCSV = async () => {
    setExporting(true);
    setError(null);
    try {
      const token = auth.getAccessToken();
      if (!token) throw new Error('No auth token');
      const blob = await ApiService.downloadReport(token);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoices_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export CSV');
      console.error('Error exporting CSV:', err);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="text-2xl font-bold text-indigo-600">FactuTable</div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/home')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Volver a Home
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Uploaded Invoices</h1>
          <button
            onClick={handleExportCSV}
            disabled={exporting || invoices.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? 'Exporting...' : 'Export to CSV'}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-600">Loading invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No invoices uploaded yet</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {invoices.map((invoice) => (
              <div key={invoice.file_key} className="bg-white border border-gray-200 rounded-lg shadow">
                <button
                  onClick={() => handleToggleInvoice(invoice.file_key)}
                  className="w-full px-4 py-4 text-left hover:bg-gray-50 transition-colors flex justify-between items-center"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{invoice.filename}</p>
                    <p className="text-sm text-gray-600 mt-1">File: {invoice.file_key}</p>
                  </div>
                  <span className="text-gray-400">
                    {expandedInvoice === invoice.file_key ? '▼' : '▶'}
                  </span>
                </button>

                {expandedInvoice === invoice.file_key && (
                  <div className="border-t border-gray-200 px-4 py-4 bg-gray-50">
                    {loadingData[invoice.file_key] ? (
                      <p className="text-gray-600">Loading data...</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-600">Total</p>
                          <p className="text-lg font-bold text-gray-900">
                            {invoiceData[invoice.file_key]?.total || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-600">Date</p>
                          <p className="text-lg font-bold text-gray-900">
                            {invoiceData[invoice.file_key]?.fecha || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-600">CUIT</p>
                          <p className="text-lg font-bold text-gray-900">
                            {invoiceData[invoice.file_key]?.cuit || 'N/A'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-600">Provider</p>
                          <p className="text-lg font-bold text-gray-900">
                            {invoiceData[invoice.file_key]?.proveedor || 'N/A'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;