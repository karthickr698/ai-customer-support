import { createBrowserRouter } from 'react-router-dom';
import { featureRoutes } from './feature-routes';
import { NotFound } from './not-found';
import { RootLayout } from './root-layout';
import { RouteError } from './route-error';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        lazy: async () => {
          const { RootPlaceholder } = await import('./root-placeholder');
          return { Component: RootPlaceholder };
        },
      },
      ...featureRoutes,
      {
        path: '*',
        element: <NotFound />,
      },
    ],
  },
]);
