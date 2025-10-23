// Service for handling file uploads with presigned URLs
import { CONFIG, authManager } from './config.js';

export class UploadService {
  constructor() {
    this.apiEndpoint = CONFIG.API_GATEWAY_ENDPOINT;
  }

  // Get presigned URL for file upload
  async getPresignedUrl(fileName, fileType) {
    try {
      const response = await fetch(`${this.apiEndpoint}/uploads/presign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authManager.getAuthHeader()
        },
        body: JSON.stringify({
          fileName: fileName,
          fileType: fileType
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to get presigned URL:', error);
      throw error;
    }
  }

  // Upload file to S3 using presigned POST
  async uploadFile(file, presignedData) {
    try {
      const formData = new FormData();
      
      // Add the presigned fields
      Object.keys(presignedData.fields).forEach(key => {
        formData.append(key, presignedData.fields[key]);
      });
      
      // Add the file last
      formData.append('file', file);

      const response = await fetch(presignedData.url, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('File upload failed:', error);
      throw error;
    }
  }

  // Process uploaded file (trigger processing lambda)
  async processFile(fileName) {
    // El procesamiento se hace automáticamente cuando se sube el archivo a S3
    // No necesitamos llamar a un endpoint separado
    return {
      message: "File processing started automatically",
      fileName: fileName
    };
  }

  // Complete upload workflow: get presigned URL, upload file, and process
  async uploadAndProcess(file) {
    try {
      // Step 1: Get presigned URL
      const presignedData = await this.getPresignedUrl(file.name, file.type);
      
      // Step 2: Upload file to S3
      await this.uploadFile(file, presignedData.upload_url);
      
      // Step 3: Process the file
      const processResult = await this.processFile(presignedData.file_key);
      
      return {
        success: true,
        fileName: presignedData.file_key,
        processResult: processResult
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Create global upload service instance
export const uploadService = new UploadService();
