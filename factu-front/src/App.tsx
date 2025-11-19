import { useState, useEffect } from "react";
import React from "react";
import { HashRouter as Router, Route, Routes, useNavigate } from "react-router-dom";
import { ApiService } from "./services/apiService";
import { useAuth } from "./hooks/useAuth";
import Reports from "./Reports";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/home" element={<Home />} />
        <Route path="/reports" element={<Reports />} />
        {/* <Route path="/auth/callback" element={<AuthCallBack />} /> */}
      </Routes>
    </Router>
  );
};

const Landing = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  // Redirigir a /home si el usuario está autenticado
  useEffect(() => {
    if (auth.isAuthenticated && !auth.isLoading) {
      navigate('/home');
    }
  }, [auth.isAuthenticated, auth.isLoading, navigate]);

  const handleStartNow = () => {
    auth.login();
  };

  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error de Autenticación</h1>
          <p className="text-red-500 mb-4">{auth.error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="text-2xl font-bold text-indigo-600">FactuTable</div>
            </div>
            <button 
              onClick={handleStartNow}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Start Now
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          {/* Logo/Brand */}
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-full mb-6">
              <span className="text-3xl font-bold text-white">F</span>
            </div>
            <h1 className="text-6xl md:text-7xl font-bold text-gray-900 mb-6">
              FactuTable
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Transforma tus facturas en datos inteligentes. 
              <span className="text-indigo-600 font-semibold"> Automatiza, analiza y optimiza</span> tu gestión financiera.
            </p>
          </div>

          {/* CTA Button */}
          <div className="mb-16">
            <button 
              onClick={handleStartNow}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
            >
              Start Now →
            </button>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-gray-200 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">
            <p>&copy; 2024 FactuTable. Transformando la gestión de facturas.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

const Home = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    const accessToken = auth.getAccessToken();
    if (!selectedFile || !accessToken) return;
    
    setIsUploading(true);
    try {
      console.log('Obteniendo presigned URL para:', selectedFile.name);
      
      // Obtener presigned URL del API Gateway
      const presignedData = await ApiService.getPresignedUrl(accessToken, selectedFile.name);
      console.log('Presigned URL obtenida:', presignedData);
      
      // Subir archivo a S3 usando la presigned URL
      await ApiService.uploadFileToS3(presignedData, selectedFile);
      
      console.log('Archivo subido exitosamente a S3');
      alert('¡Archivo subido exitosamente!');
      
      // Limpiar el archivo seleccionado
      setSelectedFile(null);
    } catch (error) {
      console.error('Error durante la subida:', error);
      alert(`Error al subir el archivo: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGoToReports = () => {
    navigate('/reports');
  };

  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error de Autenticación</h1>
          <p className="text-red-500 mb-4">{auth.error}</p>
          <button 
            onClick={() => navigate('/')}
            className="bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    navigate('/');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <div className="text-2xl font-bold text-indigo-600">FactuTable</div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-600">Hola, {auth.user?.email}</span>
              <button 
                onClick={auth.logout}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Subir Factura
          </h1>
          {/* Botón para ir a Reports */}
          <div className="mb-8 text-center">
            <button
              onClick={handleGoToReports}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Ver mis facturas
            </button>
          </div>
          <div className="max-w-2xl mx-auto">
            {/* File Upload Area */}
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Arrastra tu factura aquí
              </h3>
              <p className="text-gray-600 mb-6">
                O haz clic para seleccionar un archivo
              </p>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg cursor-pointer transition-colors inline-block"
              >
                Seleccionar Archivo
              </label>
            </div>
            {/* Selected File Info */}
            {selectedFile && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
            {/* Upload Button */}
            <div className="mt-8 text-center">
              <button
                onClick={handleUpload}
                disabled={!selectedFile || isUploading}
                className={`px-8 py-3 rounded-lg font-semibold transition-all ${
                  selectedFile && !isUploading
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white transform hover:scale-105'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isUploading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Subiendo...
                  </div>
                ) : (
                  'Subir Factura'
                )}
              </button>
            </div>
            {/* Supported Formats */}
            <div className="mt-8 text-center">
              <p className="text-sm text-gray-500">
                Formatos soportados: PDF(máx. 10MB)
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;