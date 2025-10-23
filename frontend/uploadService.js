// Service for handling file uploads with presigned URLs
import { CONFIG, authManager } from './config.js';

export class UploadService {
  constructor() {
    this.apiEndpoint = CONFIG.API_GATEWAY_ENDPOINT;
  }

  // Get presigned URL for file upload
  async getPresignedUrl(fileName, fileType) {
    try {
      const response = await fetch(`${this.apiEndpoint}/presigned-url`, {
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

  // Upload file to S3 using presigned URL
  async uploadFile(file, presignedUrl) {
    try {
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
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
    try {
      const response = await fetch(`${this.apiEndpoint}/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authManager.getAuthHeader()
        },
        body: JSON.stringify({
          fileName: fileName
        })
      });

      if (!response.ok) {
        throw new Error(`Processing failed with status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('File processing failed:', error);
      throw error;
    }
  }

  // Complete upload workflow: get presigned URL, upload file, and process
  async uploadAndProcess(file) {
    try {
      // Step 1: Get presigned URL
      const presignedData = await this.getPresignedUrl(file.name, file.type);
      
      // Step 2: Upload file to S3
      await this.uploadFile(file, presignedData.uploadUrl);
      
      // Step 3: Process the file
      const processResult = await this.processFile(presignedData.fileName);
      
      return {
        success: true,
        fileName: presignedData.fileName,
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
