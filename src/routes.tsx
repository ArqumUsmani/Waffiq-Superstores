import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import Home from './pages/Home';
import AislePage from './pages/AislePage';
import ProductPage from './pages/ProductPage';
import NotFound from './pages/NotFound';

/* Every route is bundled eagerly: a lazy chunk that has not loaded yet would
   suspend at the launch transition's cover moment, and the flood would fade
   out over the old page. */
export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'aisle/:slug', element: <AislePage /> },
      { path: 'product/:sku', element: <ProductPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
