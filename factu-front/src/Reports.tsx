'use client';

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiService } from './services/apiService';


interface ExtractedData {
  total?: string;
  fecha?: string;
  cuit?: string;
  proveedor?: string;
  text_length?: number;
  file_size?: number;
}

interface InvoiceItem {
  PK: string;
  SK: string;
  file_key: string;
  data: ExtractedData;
}

const Reports = () => {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const navigate = useNavigate();

  // Fetch invoices using report-generator lambda
  const fetchInvoices = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('No auth token');
      
      const data = await ApiService.fetchReport(token);
      // La lambda devuelve { username, facturas } o data.facturas directamente
      setInvoices(Array.isArray(data.facturas) ? data.facturas : Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch invoices');
      console.error('Error fetching invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  // Export invoices to CSV (uses ApiService.downloadReport)
  const handleExportCSV = async () => {
    setExporting(true);
    setError(null);
    try {
      const token = localStorage.getItem('authToken');
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

  // Trigger report generation (uses ApiService.generateReport)
  const handleGenerateReport = async () => {
    setGenerating(true);
    setError(null);
    try {
      await fetchInvoices();
      setError('Invoices refreshed successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh invoices');
      console.error('Error refreshing invoices:', err);
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
    // eslint-disable-next-line
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header igual que en App.tsx */}
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
          <div className="flex items-center space-x-3">
            <button
              onClick={handleGenerateReport}
              disabled={generating}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {generating ? 'Generating...' : 'Generate Report'}
            </button>
            <button
              onClick={handleExportCSV}
              disabled={exporting || invoices.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {exporting ? 'Exporting...' : 'Export to CSV'}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {!selectedInvoice ? (
          <div>
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
                  <div
                    key={`${invoice.PK}-${invoice.SK}`}
                    onClick={() => setSelectedInvoice(invoice)}
                    className="p-4 bg-white border border-gray-200 rounded-lg shadow hover:shadow-lg cursor-pointer transition-shadow"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-gray-900 break-all">{invoice.file_key}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {invoice.data.proveedor && `Provider: ${invoice.data.proveedor}`}
                        </p>
                      </div>
                      {invoice.data.total && (
                        <p className="text-lg font-bold text-gray-900">
                          ${invoice.data.total}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow p-8">
            <button
              onClick={() => setSelectedInvoice(null)}
              className="mb-6 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition-colors"
            >
              ← Back to List
            </button>

            <h2 className="text-2xl font-bold text-gray-900 mb-6 break-all">
              {selectedInvoice.file_key}
            </h2>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-semibold text-gray-600">Total</p>
                <p className="text-xl font-bold text-gray-900">
                  {selectedInvoice.data.total || 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600">Date</p>
                <p className="text-xl font-bold text-gray-900">
                  {selectedInvoice.data.fecha || 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600">CUIT</p>
                <p className="text-xl font-bold text-gray-900">
                  {selectedInvoice.data.cuit || 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-gray-600">Provider</p>
                <p className="text-xl font-bold text-gray-900">
                  {selectedInvoice.data.proveedor || 'N/A'}
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                File Size: {selectedInvoice.data.file_size || 'N/A'} bytes | Text Length: {selectedInvoice.data.text_length || 'N/A'} characters
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;