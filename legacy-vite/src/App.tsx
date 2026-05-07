import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/layout/Sidebar';
import { LoginPage } from './components/auth/LoginPage';
import { Dashboard } from './pages/Dashboard';
import Solicitacoes from './pages/Solicitacoes';
import Cargas from './pages/Cargas';
import CargaDetail from './pages/CargaDetail';
import Products from './pages/Products';
import Cadastros from './pages/Cadastros';
import Usuarios from './pages/Usuarios';
import Agenda from './pages/Agenda';

import { Toaster } from './components/ui/sonner';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return (
    <div className="h-screen w-screen flex items-center justify-center bg-zinc-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;
  
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto scroll-smooth">
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/agenda" element={<PrivateRoute><Agenda /></PrivateRoute>} />
          <Route path="/solicitacoes" element={<PrivateRoute><Solicitacoes /></PrivateRoute>} />
          <Route path="/cargas" element={<PrivateRoute><Cargas /></PrivateRoute>} />
          <Route path="/cargas/:id" element={<PrivateRoute><CargaDetail /></PrivateRoute>} />
          <Route path="/produtos" element={<PrivateRoute><Products /></PrivateRoute>} />
          <Route path="/usuarios" element={<PrivateRoute><Usuarios /></PrivateRoute>} />
          <Route path="/cadastros" element={<PrivateRoute><Cadastros /></PrivateRoute>} />
        </Routes>
      </Router>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}
