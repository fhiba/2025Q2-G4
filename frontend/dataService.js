// Service for handling DynamoDB data operations
import { CONFIG, authManager } from './config.js';

export class DataService {
  constructor() {
    this.apiEndpoint = CONFIG.API_GATEWAY_ENDPOINT;
  }

  // Get all data from DynamoDB
  async getAllData() {
    try {
      const response = await fetch(`${this.apiEndpoint}/data`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authManager.getAuthHeader()
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch data:', error);
      throw error;
    }
  }

  // Get single record by ID
  async getRecordById(id) {
    try {
      const response = await fetch(`${this.apiEndpoint}/data/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...authManager.getAuthHeader()
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to fetch record:', error);
      throw error;
    }
  }

  // Update record in DynamoDB
  async updateRecord(id, recordData) {
    try {
      const response = await fetch(`${this.apiEndpoint}/data/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authManager.getAuthHeader()
        },
        body: JSON.stringify(recordData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to update record:', error);
      throw error;
    }
  }

  // Create new record
  async createRecord(recordData) {
    try {
      const response = await fetch(`${this.apiEndpoint}/data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authManager.getAuthHeader()
        },
        body: JSON.stringify(recordData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to create record:', error);
      throw error;
    }
  }

  // Delete record
  async deleteRecord(id) {
    try {
      const response = await fetch(`${this.apiEndpoint}/data/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...authManager.getAuthHeader()
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Failed to delete record:', error);
      throw error;
    }
  }
}

// Create global data service instance
export const dataService = new DataService();
