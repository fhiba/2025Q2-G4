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
  const [editingInvoice, setEditingInvoice] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{ [key: string]: ExtractedData }>({});
  const [updating, setUpdating] = useState<{ [key: string]: boolean }>({});
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

  // Start editing an invoice
  const handleStartEdit = (fileKey: string) => {
    setEditingInvoice(fileKey);
    setEditFormData({
      [fileKey]: { ...invoiceData[fileKey] }
    });
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingInvoice(null);
    setEditFormData({});
  };

  // Save invoice updates
  const handleSaveEdit = async (fileKey: string) => {
    setUpdating(prev => ({ ...prev, [fileKey]: true }));
    setError(null);
    try {
      const token = auth.getAccessToken();
      if (!token) throw new Error('No auth token');

      const updates: any = {};
      const formData = editFormData[fileKey];
      const currentData = invoiceData[fileKey] || {};
      
      // Normalizar valores para comparación (convertir null/undefined a string vacío)
      const normalizeValue = (val: any) => val ?? '';
      
      // Comparar y agregar todos los campos que han cambiado o están presentes
      if (formData?.total !== undefined) {
        const newTotal = normalizeValue(formData.total);
        const oldTotal = normalizeValue(currentData.total);
        if (newTotal !== oldTotal) {
          updates.total = formData.total || null;
        }
      }
      if (formData?.fecha !== undefined) {
        const newFecha = normalizeValue(formData.fecha);
        const oldFecha = normalizeValue(currentData.fecha);
        if (newFecha !== oldFecha) {
          updates.fecha = formData.fecha || null;
        }
      }
      if (formData?.proveedor !== undefined) {
        const newProveedor = normalizeValue(formData.proveedor);
        const oldProveedor = normalizeValue(currentData.proveedor);
        if (newProveedor !== oldProveedor) {
          updates.proveedor = formData.proveedor || null;
        }
      }
      if (formData?.cuit !== undefined) {
        const newCuit = normalizeValue(formData.cuit);
        const oldCuit = normalizeValue(currentData.cuit);
        if (newCuit !== oldCuit) {
          updates.cuit = formData.cuit || null;
        }
      }

      if (Object.keys(updates).length === 0) {
        setEditingInvoice(null);
        return;
      }

      const response = await ApiService.updateInvoice(token, fileKey, updates);
      
      // Update local state with the response
      // La respuesta contiene updated_item con la estructura de DynamoDB
      // Los datos están dentro de updated_item.data
      if (response.updated_item) {
        const updatedData = response.updated_item.data || {};
        setInvoiceData(prev => ({
          ...prev,
          [fileKey]: {
            total: updatedData.total ?? invoiceData[fileKey]?.total ?? null,
            fecha: updatedData.fecha ?? invoiceData[fileKey]?.fecha ?? null,
            cuit: updatedData.cuit ?? invoiceData[fileKey]?.cuit ?? null,
            proveedor: updatedData.proveedor ?? invoiceData[fileKey]?.proveedor ?? null,
            text_length: updatedData.text_length ?? invoiceData[fileKey]?.text_length ?? null,
            file_size: updatedData.file_size ?? invoiceData[fileKey]?.file_size ?? null,
          }
        }));
      }
      
      setEditingInvoice(null);
      setEditFormData({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update invoice');
      console.error('Error updating invoice:', err);
    } finally {
      setUpdating(prev => ({ ...prev, [fileKey]: false }));
    }
  };

  // Handle input change in edit form
  const handleInputChange = (fileKey: string, field: keyof ExtractedData, value: string) => {
    setEditFormData(prev => ({
      ...prev,
      [fileKey]: {
        ...prev[fileKey],
        ...invoiceData[fileKey],
        [field]: value
      }
    }));
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
              <div onClick={() => navigate('/home')} className="text-2xl font-bold text-indigo-600">FactuTable</div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/home')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Subir factura
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Mis facturas</h1>
          <button
            onClick={handleExportCSV}
            disabled={exporting || invoices.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? 'Exportando...' : 'Exportar a CSV'}
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
                <div className="w-full px-4 py-4 hover:bg-gray-50 transition-colors flex justify-between items-center">
                  <button
                    onClick={() => handleToggleInvoice(invoice.file_key)}
                    className="text-left flex-1 text-sm sm:text-base"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">{invoice.filename}</p>
                      <p className="text-sm text-gray-600 mt-1">File: {invoice.file_key}</p>
                    </div>
                  </button>

                  <div className="flex items-center space-x-3 ml-4">
                    <button
                      title="Download PDF"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const token = auth.getAccessToken();
                          if (!token) throw new Error('No auth token');
                          const url = await ApiService.downloadPdf(token, invoice.file_key);
                          window.open(url, '_blank');
                        } catch (err) {
                          setError(err instanceof Error ? err.message : 'Failed to request PDF');
                          console.error('Error requesting PDF:', err);
                        }
                      }}
                      className="p-2 bg-indigo-50 hover:bg-indigo-100 rounded-md text-indigo-600"
                    >
                      ⬇️
                    </button>

                    <button
                      onClick={() => handleToggleInvoice(invoice.file_key)}
                      className="p-2 text-gray-400"
                    >
                      {expandedInvoice === invoice.file_key ? '' : ''}
                    </button>
                  </div>
                </div>

                {expandedInvoice === invoice.file_key && (
                  <div className="border-t border-gray-200 px-4 py-4 bg-gray-50">
                    {loadingData[invoice.file_key] ? (
                      <p className="text-gray-600">Loading data...</p>
                    ) : editingInvoice === invoice.file_key ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-sm font-semibold text-gray-600 block mb-1">Total</label>
                            <input
                              type="text"
                              value={editFormData[invoice.file_key]?.total || ''}
                              onChange={(e) => handleInputChange(invoice.file_key, 'total', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="Total"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-gray-600 block mb-1">Date</label>
                            <input
                              type="text"
                              value={editFormData[invoice.file_key]?.fecha || ''}
                              onChange={(e) => handleInputChange(invoice.file_key, 'fecha', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="YYYY-MM-DD"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-gray-600 block mb-1">CUIT</label>
                            <input
                              type="text"
                              value={editFormData[invoice.file_key]?.cuit || ''}
                              onChange={(e) => handleInputChange(invoice.file_key, 'cuit', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="CUIT"
                            />
                          </div>
                          <div>
                            <label className="text-sm font-semibold text-gray-600 block mb-1">Provider</label>
                            <input
                              type="text"
                              value={editFormData[invoice.file_key]?.proveedor || ''}
                              onChange={(e) => handleInputChange(invoice.file_key, 'proveedor', e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="Provider"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end space-x-2 pt-2">
                          <button
                            onClick={handleCancelEdit}
                            disabled={updating[invoice.file_key]}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => handleSaveEdit(invoice.file_key)}
                            disabled={updating[invoice.file_key]}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed transition-colors"
                          >
                            {updating[invoice.file_key] ? 'Guardando...' : 'Guardar'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
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
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleStartEdit(invoice.file_key)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                          >
                            ✏️ Editar
                          </button>
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