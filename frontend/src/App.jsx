import { useState } from 'react';
import LoginPage from './pages/LoginPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import FarmProfile from './pages/FarmProfile.jsx';

export default function App() {
  const [officer, setOfficer] = useState(null);
  const [openFarmId, setOpenFarmId] = useState(null);

  function openFarm(farmId) {
    setOpenFarmId(farmId);
    window.scrollTo(0, 0);
  }

  function signOut() {
    setOfficer(null);
    setOpenFarmId(null);
  }

  if (!officer) {
    return <LoginPage onSignedIn={setOfficer} />;
  }
  if (openFarmId) {
    return (
      <FarmProfile
        officer={officer}
        farmId={openFarmId}
        onOpenFarm={openFarm}
        onBack={() => setOpenFarmId(null)}
        onSignOut={signOut}
      />
    );
  }
  return <Dashboard officer={officer} onSignOut={signOut} onOpenFarm={openFarm} />;
}
