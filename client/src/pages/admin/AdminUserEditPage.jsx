import { useParams } from 'react-router-dom';
import AdminSetupPage from './AdminSetupPage';

export default function AdminUserEditPage() {
  const { userId } = useParams();
  return (
    <AdminSetupPage
      screen="account-edit"
      initialFields={{ update: [userId] }}
    />
  );
}
