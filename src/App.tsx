import React, { useEffect } from 'react';
import { useInventoryStore } from './store/useInventoryStore';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { StockMasterView } from './components/StockMasterView';
import { StockEntryView } from './components/StockEntryView';
import { AuditView } from './components/AuditView';
import { LowStockView } from './components/LowStockView';
import { TallySyncView } from './components/TallySyncView';
import { SalesDispatchView } from './components/SalesDispatchView';
import { LocationStockView } from './components/LocationStockView';
import { CommandPalette } from './components/CommandPalette';
import { SkuInspectorDrawer } from './components/SkuInspectorDrawer';
import { StockTransactionModal } from './components/StockTransactionModal';
import { UpdateWriteOffModal } from './components/UpdateWriteOffModal';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { AddNewSkuModal } from './components/AddNewSkuModal';
import { UserManagementModal } from './components/UserManagementModal';
import { CloudSyncModal } from './components/CloudSyncModal';
import { LoginScreen } from './components/LoginScreen';

export const App: React.FC = () => {
  const { 
    currentUser,
    activeModule, 
    isDarkMode,
    setKeyboardShortcutsOpen, 
    isKeyboardShortcutsOpen,
    isCommandPaletteOpen,
    selectedSku,
    setSelectedSku
  } = useInventoryStore();

  // Sync dark class with isDarkMode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Global hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle shortcuts help on '?'
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setKeyboardShortcutsOpen(!isKeyboardShortcutsOpen);
      }
      // Escape closes drawer if open and not in palette
      if (e.key === 'Escape' && selectedSku && !isCommandPaletteOpen) {
        setSelectedSku(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isKeyboardShortcutsOpen, isCommandPaletteOpen, selectedSku]);

  // If no user is logged in, show the clean full-screen Login Screen!
  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased selection:bg-orange-500 selection:text-white">
      {/* Collapsible Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Sticky Top Header */}
        <Header />

        {/* Dynamic Viewport */}
        <main className="flex-1 overflow-y-auto">
          {activeModule === 'stock-master' && <StockMasterView />}
          {activeModule === 'sales-dispatch' && <SalesDispatchView />}
          {activeModule === 'location-stock' && <LocationStockView />}
          {activeModule === 'stock-entry' && <StockEntryView />}
          {activeModule === 'write-off-audit' && <AuditView />}
          {(activeModule === 'stock-alerts' || activeModule === ('low-stock-alerts' as any)) && <LowStockView />}
          {activeModule === 'tally-sync' && <TallySyncView />}
        </main>
      </div>

      {/* Modals & Slide-Over Drawers */}
      <CommandPalette />
      <SkuInspectorDrawer />
      <StockTransactionModal />
      <UpdateWriteOffModal />
      <KeyboardShortcutsModal />
      <AddNewSkuModal />
      <UserManagementModal />
      <CloudSyncModal />
    </div>
  );
};

export default App;
