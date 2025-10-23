// Import services
import { authManager } from './config.js';
import { uploadService } from './uploadService.js';
import { dataService } from './dataService.js';

// PDF upload functionality
const fileInput = document.getElementById('fileInput');
const uploadForm = document.getElementById('uploadForm');
const responseOutput = document.getElementById('responseOutput');
const fileFeedback = document.getElementById('fileFeedback');
const loginBtn = document.getElementById('loginBtn');
const backgroundAnimation = document.getElementById('backgroundAnimation');
const brand = document.querySelector('.brand');

// Navigation elements
const nav = document.getElementById('nav');
const navBtns = document.querySelectorAll('.nav-btn');
const uploadContainer = document.querySelector('.upload-container');
const dataContainer = document.getElementById('dataContainer');

// Data management elements
const refreshBtn = document.getElementById('refreshBtn');
const addBtn = document.getElementById('addBtn');
const dataTableBody = document.getElementById('dataTableBody');
const dataLoading = document.getElementById('dataLoading');

// Modal elements
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const closeModal = document.getElementById('closeModal');
const cancelEdit = document.getElementById('cancelEdit');
const saveEdit = document.getElementById('saveEdit');
const modalTitle = document.getElementById('modalTitle');

// User info elements
let userInfoElement = null;
let currentPage = 'upload';
let currentEditId = null;

// Initialize application
async function initializeApp() {
  try {
    // Initialize authentication (this will handle the callback if present)
    await authManager.initialize();
    
    // Check if we just completed a login
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true' || urlParams.get('code')) {
      // The callback was handled in initialize(), show success message
      showSuccessMessage('Login successful!');
    }
    
    // Update UI based on authentication status
    updateUI();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    showErrorMessage('Failed to initialize application');
  }
}

// Update UI based on authentication status
function updateUI() {
  if (authManager.isAuthenticated) {
    // User is logged in
    loginBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
        <polyline points="16,17 21,12 16,7"></polyline>
        <line x1="21" y1="12" x2="9" y2="12"></line>
      </svg>
    `;
    loginBtn.title = 'Logout';
    
    // Show user info
    if (!userInfoElement) {
      userInfoElement = document.createElement('div');
      userInfoElement.className = 'user-info';
      userInfoElement.innerHTML = `
        <span class="user-name">Welcome, ${authManager.user.name || authManager.user.email || 'User'}</span>
      `;
      brand.parentNode.insertBefore(userInfoElement, brand.nextSibling);
    }
    
    // Show navigation
    nav.style.display = 'flex';
    
    // Enable current page functionality
    if (currentPage === 'upload') {
      uploadForm.style.display = 'flex';
      fileInput.disabled = false;
    } else if (currentPage === 'data') {
      loadData();
    }
  } else {
    // User is not logged in
    loginBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>
    `;
    loginBtn.title = 'Login';
    
    // Hide user info
    if (userInfoElement) {
      userInfoElement.remove();
      userInfoElement = null;
    }
    
    // Hide navigation
    nav.style.display = 'none';
    
    // Disable all forms
    uploadForm.style.display = 'none';
    fileInput.disabled = true;
    dataContainer.style.display = 'none';
  }
}

// Handle file selection
fileInput.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    console.log('Selected file:', file.name);
    // Show file feedback
    fileFeedback.innerHTML = `<div class="file-selected">📄 Selected: <strong>${file.name}</strong></div>`;
    // Clear previous response
    responseOutput.textContent = '';
  } else {
    // Clear feedback if no file selected
    fileFeedback.innerHTML = '';
  }
});

// Handle form submission for PDF upload
uploadForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  
  if (!authManager.isAuthenticated) {
    showErrorMessage('Please login first to upload files.');
    return;
  }
  
  const file = fileInput.files[0];
  if (!file) {
    responseOutput.textContent = 'Please select a PDF file first.';
    return;
  }

  // Show loading state
  responseOutput.textContent = 'Getting presigned URL and uploading file...';
  
  try {
    const result = await uploadService.uploadAndProcess(file);
    
    if (result.success) {
      responseOutput.textContent = `✅ Upload successful!\n\nFile: ${result.fileName}\n\nProcessing result:\n${JSON.stringify(result.processResult, null, 2)}`;
      showSuccessMessage('File uploaded and processed successfully!');
      
      // Clear form
      fileInput.value = '';
      fileFeedback.innerHTML = '';
    } else {
      responseOutput.textContent = `❌ Upload failed: ${result.error}`;
      showErrorMessage('Upload failed. Please try again.');
    }
  } catch (error) {
    responseOutput.textContent = `Error: ${error.message}`;
    showErrorMessage('An error occurred during upload.');
    console.error('Upload error:', error);
  }
});

// Login/logout button handler
loginBtn.addEventListener('click', async () => {
  if (authManager.isAuthenticated) {
    await authManager.logout();
  } else {
    await authManager.login();
  }
});

// Utility functions for user feedback
function showSuccessMessage(message) {
  // Create or update success message
  let successMsg = document.getElementById('successMessage');
  if (!successMsg) {
    successMsg = document.createElement('div');
    successMsg.id = 'successMessage';
    successMsg.className = 'message success-message';
    document.body.appendChild(successMsg);
  }
  
  successMsg.textContent = message;
  successMsg.style.display = 'block';
  
  // Hide after 3 seconds
  setTimeout(() => {
    successMsg.style.display = 'none';
  }, 3000);
}

function showErrorMessage(message) {
  // Create or update error message
  let errorMsg = document.getElementById('errorMessage');
  if (!errorMsg) {
    errorMsg = document.createElement('div');
    errorMsg.id = 'errorMessage';
    errorMsg.className = 'message error-message';
    document.body.appendChild(errorMsg);
  }
  
  errorMsg.textContent = message;
  errorMsg.style.display = 'block';
  
  // Hide after 5 seconds
  setTimeout(() => {
    errorMsg.style.display = 'none';
  }, 5000);
}

// Mouse tracking background animation
document.addEventListener('mousemove', (e) => {
  const x = (e.clientX / window.innerWidth) * 100;
  const y = (e.clientY / window.innerHeight) * 100;
  
  backgroundAnimation.style.setProperty('--mouse-x', `${x}%`);
  backgroundAnimation.style.setProperty('--mouse-y', `${y}%`);
});

// Navigation functions
function switchPage(page) {
  currentPage = page;
  
  // Update navigation buttons
  navBtns.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.page === page) {
      btn.classList.add('active');
    }
  });
  
  // Show/hide containers
  if (page === 'upload') {
    uploadContainer.style.display = 'block';
    dataContainer.style.display = 'none';
  } else if (page === 'data') {
    uploadContainer.style.display = 'none';
    dataContainer.style.display = 'block';
    if (authManager.isAuthenticated) {
      loadData();
    }
  }
}

// Data management functions
async function loadData() {
  if (!authManager.isAuthenticated) {
    showErrorMessage('Please login to view data');
    return;
  }
  
  try {
    dataLoading.style.display = 'flex';
    dataTableBody.innerHTML = '';
    
    const data = await dataService.getAllData();
    displayData(data);
  } catch (error) {
    console.error('Failed to load data:', error);
    showErrorMessage('Failed to load data. Please try again.');
  } finally {
    dataLoading.style.display = 'none';
  }
}

function displayData(data) {
  dataTableBody.innerHTML = '';
  
  if (!data || data.length === 0) {
    dataTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 40px; color: #718096;">
          No data available
        </td>
      </tr>
    `;
    return;
  }
  
  data.forEach(record => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${record.id || 'N/A'}</td>
      <td>${record.invoiceNumber || 'N/A'}</td>
      <td>${record.date ? new Date(record.date).toLocaleDateString() : 'N/A'}</td>
      <td>${record.amount ? `$${parseFloat(record.amount).toFixed(2)}` : 'N/A'}</td>
      <td>
        <span class="status-badge status-${record.status || 'pending'}">
          ${record.status || 'pending'}
        </span>
      </td>
      <td>
        <button class="action-btn edit-btn" data-id="${record.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="action-btn delete-btn" data-id="${record.id}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"></polyline>
            <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
          </svg>
        </button>
      </td>
    `;
    dataTableBody.appendChild(row);
  });
}

function openEditModal(recordId = null) {
  currentEditId = recordId;
  
  if (recordId) {
    // Edit existing record
    modalTitle.textContent = 'Edit Record';
    loadRecordForEdit(recordId);
  } else {
    // Create new record
    modalTitle.textContent = 'Add New Record';
    clearEditForm();
  }
  
  editModal.style.display = 'flex';
}

async function loadRecordForEdit(recordId) {
  try {
    const record = await dataService.getRecordById(recordId);
    populateEditForm(record);
  } catch (error) {
    console.error('Failed to load record:', error);
    showErrorMessage('Failed to load record for editing');
  }
}

function populateEditForm(record) {
  document.getElementById('editId').value = record.id || '';
  document.getElementById('editInvoiceNumber').value = record.invoiceNumber || '';
  document.getElementById('editDate').value = record.date ? record.date.split('T')[0] : '';
  document.getElementById('editAmount').value = record.amount || '';
  document.getElementById('editStatus').value = record.status || 'pending';
  document.getElementById('editDescription').value = record.description || '';
}

function clearEditForm() {
  document.getElementById('editId').value = '';
  document.getElementById('editInvoiceNumber').value = '';
  document.getElementById('editDate').value = '';
  document.getElementById('editAmount').value = '';
  document.getElementById('editStatus').value = 'pending';
  document.getElementById('editDescription').value = '';
}

function closeEditModal() {
  editModal.style.display = 'none';
  currentEditId = null;
  clearEditForm();
}

async function saveRecord(formData) {
  try {
    const recordData = {
      invoiceNumber: formData.invoiceNumber,
      date: formData.date,
      amount: parseFloat(formData.amount),
      status: formData.status,
      description: formData.description
    };
    
    if (currentEditId) {
      // Update existing record
      await dataService.updateRecord(currentEditId, recordData);
      showSuccessMessage('Record updated successfully!');
    } else {
      // Create new record
      await dataService.createRecord(recordData);
      showSuccessMessage('Record created successfully!');
    }
    
    closeEditModal();
    loadData(); // Refresh the table
  } catch (error) {
    console.error('Failed to save record:', error);
    showErrorMessage('Failed to save record. Please try again.');
  }
}

async function deleteRecord(recordId) {
  if (!confirm('Are you sure you want to delete this record?')) {
    return;
  }
  
  try {
    await dataService.deleteRecord(recordId);
    showSuccessMessage('Record deleted successfully!');
    loadData(); // Refresh the table
  } catch (error) {
    console.error('Failed to delete record:', error);
    showErrorMessage('Failed to delete record. Please try again.');
  }
}

// Event listeners
navBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const page = btn.dataset.page;
    switchPage(page);
  });
});

refreshBtn.addEventListener('click', loadData);

addBtn.addEventListener('click', () => {
  if (!authManager.isAuthenticated) {
    showErrorMessage('Please login to add records');
    return;
  }
  openEditModal();
});

// Modal event listeners
closeModal.addEventListener('click', closeEditModal);
cancelEdit.addEventListener('click', closeEditModal);

editForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const formData = new FormData(editForm);
  const data = Object.fromEntries(formData.entries());
  saveRecord(data);
});

// Table action buttons (using event delegation)
dataTableBody.addEventListener('click', (e) => {
  if (e.target.closest('.edit-btn')) {
    const recordId = e.target.closest('.edit-btn').dataset.id;
    openEditModal(recordId);
  } else if (e.target.closest('.delete-btn')) {
    const recordId = e.target.closest('.delete-btn').dataset.id;
    deleteRecord(recordId);
  }
});

// Close modal when clicking outside
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) {
    closeEditModal();
  }
});

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);
