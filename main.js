// PDF upload functionality
const fileInput = document.getElementById('fileInput');
const uploadForm = document.getElementById('uploadForm');
const responseOutput = document.getElementById('responseOutput');
const fileFeedback = document.getElementById('fileFeedback');
const loginBtn = document.getElementById('loginBtn');
const backgroundAnimation = document.getElementById('backgroundAnimation');

// ALB endpoint for PDF processing
const API_ENDPOINT = "http://ALB-factutable-frontend-151015150.us-east-1.elb.amazonaws.com/process";

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
  
  const file = fileInput.files[0];
  if (!file) {
    responseOutput.textContent = 'Please select a PDF file first.';
    return;
  }

  // Show loading state
  responseOutput.textContent = 'Uploading and processing PDF...';
  
  try {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      body: formData
    });
    
    const responseText = await response.text();
    responseOutput.textContent = responseText;
    
    console.log('Upload response:', responseText);
  } catch (error) {
    responseOutput.textContent = `Error: ${error.message}`;
    console.error('Upload error:', error);
  }
});

// Login button placeholder (no functionality yet)
loginBtn.addEventListener('click', () => {
  console.log('Login button clicked');
});

// Mouse tracking background animation
document.addEventListener('mousemove', (e) => {
  const x = (e.clientX / window.innerWidth) * 100;
  const y = (e.clientY / window.innerHeight) * 100;
  
  backgroundAnimation.style.setProperty('--mouse-x', `${x}%`);
  backgroundAnimation.style.setProperty('--mouse-y', `${y}%`);
});
