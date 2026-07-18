import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ROUTES } from '@/utils/constants';
import { RegistroPublico } from '@/pages/RegistroPublico';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { PrivateRoute } from '@/components/layout/PrivateRoute';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path={ROUTES.REGISTRO_PUBLICO} element={<RegistroPublico />} />
          <Route path={ROUTES.LOGIN} element={<Login />} />
          <Route
            path={ROUTES.DASHBOARD}
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}

export default App;
