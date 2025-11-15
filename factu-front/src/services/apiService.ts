// API Service for communicating with the backend
import { CONFIG } from '../config';

const API_BASE_URL = CONFIG.API_GATEWAY_ENDPOINT;

export interface PresignedUrlResponse {
  upload_url: {
    url: string;
    fields: Record<string, string>;
  };
  file_key: string;
}

export class ApiService {
  private static getAuthHeaders(token: string) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  static async getPresignedUrl(token: string): Promise<PresignedUrlResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/uploads/presign`, {
        method: 'POST',
        headers: this.getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting presigned URL:', error);
      throw error;
    }
  }

  static async uploadFileToS3(presignedData: PresignedUrlResponse, file: File): Promise<void> {
    try {
      const formData = new FormData();
      
      // Add all the fields from the presigned URL
      Object.entries(presignedData.upload_url.fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
      
      // Add the file last
      formData.append('file', file);

      const response = await fetch(presignedData.upload_url.url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw error;
    }
  }

  // Fetch report (invoices/data) from report-generator lambda
  static async fetchReport(token: string): Promise<any> {
    try {
      const response = await fetch(`${API_BASE_URL}/report`, {
        method: 'GET',
        headers: this.getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching report:', error);
      throw error;
    }
  }

  // Generate/Download report CSV from export lambda
  static async downloadReport(token: string): Promise<Blob> {
    try {
      const response = await fetch(`${API_BASE_URL}/export`, {
        method: 'GET',
        headers: this.getAuthHeaders(token),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/csv')) {
        const blob = await response.blob();
        return blob;
      }

      // Fallback: lambda proxy may return JSON with base64 body
      const data = await response.json();
      if (data && data.body) {
        const byteCharacters = atob(data.body);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'text/csv' });
        return blob;
      }

      throw new Error('No CSV data received');
    } catch (error) {
      console.error('Error downloading report:', error);
      throw error;
    }
  }
}
