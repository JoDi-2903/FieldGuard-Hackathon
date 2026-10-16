import { useState } from 'react';
import LoginPage from './pages/LoginPage.jsx';
import Dashboard from './pages/Dashboard.jsx';
import FarmProfile from './pages/FarmProfile.jsx';
import { EMPTY_RECORD } from './data/visitRecord.js';

export default function App() {
  const [officer, setOfficer] = useState(null);
  const [openFarmId, setOpenFarmId] = useState(null);
  // Visit notes, photos and verdict per farm — kept while the officer moves between pages.
  const [records, setRecords] = useState({});

  function updateRecord(farmId, updater) {
    setRecords((all) => ({ ...all, [farmId]: updater(all[farmId] ?? EMPTY_RECORD) }));
  }

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
        record={records[openFarmId]}
        onRecordChange={updateRecord}
        onOpenFarm={openFarm}
        onBack={() => setOpenFarmId(null)}
        onSignOut={signOut}
      />
    );
  }
  return <Dashboard officer={officer} onSignOut={signOut} onOpenFarm={openFarm} />;
}
