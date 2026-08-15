import { Navigate } from 'react-router-dom';

export function OrganizationIndexRedirect() {
  return <Navigate replace to="members" />;
}
