import { createBrowserRouter } from 'react-router';
import { Layout } from './components/Layout';
import Home from './pages/Home';
import AislePage from './pages/AislePage';
import ProductPage from './pages/ProductPage';
import NotFound from './pages/NotFound';
import { ShopGate } from './components/shop';
import CartPage from './pages/shop/CartPage';
import LoginPage from './pages/shop/LoginPage';
import CheckoutPage from './pages/shop/CheckoutPage';
import OrderPage from './pages/shop/OrderPage';
import AccountPage from './pages/shop/AccountPage';
import ListsPage from './pages/shop/ListsPage';
import { ForgotPage, ResetPage } from './pages/shop/ResetPages';

/* Every route is bundled eagerly: a lazy chunk that has not loaded yet would
   suspend at the launch transition's cover moment, and the flood would fade
   out over the old page. */
export const router = createBrowserRouter([
  /* The admin panel: outside the site's layout, and its own chunk, so
     customers never download it. */
  { path: 'admin/*', lazy: () => import('./admin/AdminApp') },
  {
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'aisle/:slug', element: <AislePage /> },
      { path: 'product/:sku', element: <ProductPage /> },
      /* The online store. Behind ShopGate, these are "not found" unless the
         store has been switched on in the admin panel. */
      { path: 'cart', element: <ShopGate><CartPage /></ShopGate> },
      { path: 'login', element: <ShopGate><LoginPage /></ShopGate> },
      { path: 'checkout', element: <ShopGate><CheckoutPage /></ShopGate> },
      { path: 'order/:number', element: <ShopGate><OrderPage /></ShopGate> },
      { path: 'account', element: <ShopGate><AccountPage /></ShopGate> },
      { path: 'lists', element: <ShopGate><ListsPage /></ShopGate> },
      { path: 'forgot', element: <ShopGate><ForgotPage /></ShopGate> },
      { path: 'reset', element: <ShopGate><ResetPage /></ShopGate> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
