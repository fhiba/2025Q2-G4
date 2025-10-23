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
}
