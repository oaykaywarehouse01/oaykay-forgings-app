import React, { useState } from 'react';
import { 
  Users, 
  ShieldCheck, 
  KeyRound, 
  Plus, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  UserCheck, 
  Trash2,
  Edit2,
  Check,
  X,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { AppUser, UserRole } from '../types/inventory';

export const UserManagementModal: React.FC = () => {
  const { 
    isUserManagementModalOpen, 
    setUserManagementModalOpen, 
    users, 
    currentUser, 
    setCurrentUserByPin,
    addUser,
    updateUser,
    deleteUser,
    transactions,
    locationStockEntries,
    deductedSalesOrders,
    clearTransactions,
    clearAllLocationCounts,
    clearAllDispatchedOrders,
    resetDatabaseClean
  } = useInventoryStore();

  const [activeTab, setActiveTab] = useState<'switch' | 'manage' | 'purge'>('switch');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [switchSuccess, setSwitchSuccess] = useState<string | null>(null);
  const [purgeStatus, setPurgeStatus] = useState<string | null>(null);

  // Edit Active User Name inline
  const [isEditingCurName, setIsEditingCurName] = useState(false);
  const [curNameInput, setCurNameInput] = useState(currentUser.name);

  // Edit another user state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserPin, setEditUserPin] = useState('');

  // New user form state
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('count_staff');
  const [newUserPin, setNewUserPin] = useState('');

  const handleSwitchPin = (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    setSwitchSuccess(null);
    const res = setCurrentUserByPin(pinInput);
    if (res.success) {
      setSwitchSuccess(res.message);
      setPinInput('');
      setTimeout(() => {
        setSwitchSuccess(null);
        setUserManagementModalOpen(false);
      }, 1000);
    } else {
      setPinError(res.message);
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserPin.trim()) return;

    const colors = ['bg-orange-600', 'bg-emerald-600', 'bg-indigo-600', 'bg-amber-600', 'bg-purple-600', 'bg-rose-600'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];

    const defaultPerms = {
      admin: {
        canEditStockMaster: true,
        canDispatchSO: true,
        canInwardStock: true,
        canCountLocations: true,
        canGoLiveLocations: true,
        canManageUsers: true,
        canResetData: true,
      },
      dispatch_manager: {
        canEditStockMaster: false,
        canDispatchSO: true,
        canInwardStock: false,
        canCountLocations: false,
        canGoLiveLocations: false,
        canManageUsers: false,
        canResetData: false,
      },
      inward_storekeeper: {
        canEditStockMaster: false,
        canDispatchSO: false,
        canInwardStock: true,
        canCountLocations: true,
        canGoLiveLocations: false,
        canManageUsers: false,
        canResetData: false,
      },
      count_staff: {
        canEditStockMaster: false,
        canDispatchSO: false,
        canInwardStock: false,
        canCountLocations: true,
        canGoLiveLocations: false,
        canManageUsers: false,
        canResetData: false,
      }
    };

    addUser({
      name: newUserName.trim(),
      role: newUserRole,
      pin: newUserPin.trim(),
      avatarColor: randomColor,
      permissions: defaultPerms[newUserRole]
    });

    setNewUserName('');
    setNewUserPin('');
    setIsAddingUser(false);
  };

  if (!isUserManagementModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
      <div 
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-sm ${currentUser.avatarColor}`}>
              {currentUser.name.charAt(0)}
            </div>
            <div>
              {isEditingCurName ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <input
                    type="text"
                    value={curNameInput}
                    onChange={(e) => setCurNameInput(e.target.value)}
                    className="rounded-lg border border-orange-400 bg-white px-2 py-0.5 text-xs font-bold text-slate-900 dark:bg-slate-800 dark:text-white"
                    placeholder="Your Name (e.g. Manish / Admin)"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (curNameInput.trim()) {
                        updateUser(currentUser.id, { name: curNameInput.trim() });
                        setIsEditingCurName(false);
                      }
                    }}
                    className="rounded-lg bg-emerald-600 p-1 text-white hover:bg-emerald-700 transition"
                    title="Save Display Name"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setCurNameInput(currentUser.name);
                      setIsEditingCurName(false);
                    }}
                    className="rounded-lg bg-slate-200 p-1 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
                    title="Cancel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{currentUser.name}</span>
                  <button
                    onClick={() => {
                      setCurNameInput(currentUser.name);
                      setIsEditingCurName(true);
                    }}
                    className="text-slate-400 hover:text-orange-600 transition p-0.5"
                    title="Rename Profile (Set your own name)"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {currentUser.role.replace('_', ' ')}
                  </span>
                </div>
              )}
              <div className="text-xs text-slate-400">Current Active Session</div>
            </div>
          </div>

          <button
            onClick={() => setUserManagementModalOpen(false)}
            className="rounded-xl border border-slate-200 px-2.5 py-1 text-xs text-slate-400 hover:text-slate-600 dark:border-slate-700"
          >
            ✕
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-3 space-x-6 text-xs font-bold">
          <button
            onClick={() => setActiveTab('switch')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'switch'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Quick PIN Switch</span>
          </button>

          {currentUser.role === 'admin' && (
            <button
              onClick={() => setActiveTab('manage')}
              className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition ${
                activeTab === 'manage'
                  ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Admin Users ({users.length})</span>
            </button>
          )}

          {currentUser.role === 'admin' && (
            <button
              onClick={() => setActiveTab('purge')}
              className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition ${
                activeTab === 'purge'
                  ? 'border-rose-500 text-rose-600 dark:text-rose-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Data Delete & Reset</span>
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {purgeStatus && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-xs font-bold text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200 animate-in fade-in">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{purgeStatus}</span>
            </div>
          )}

          {activeTab === 'switch' && (
            <div className="space-y-5">
              <div className="text-center">
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  Switch Operator via 4-Digit Security PIN
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Default PINs: Admin (1234), Dispatch (2222), Storekeeper (3333), Count Staff (4444)
                </p>
              </div>

              {switchSuccess && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-300 p-3 text-xs font-bold text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>{switchSuccess}</span>
                </div>
              )}

              {pinError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-300 p-3 text-xs font-bold text-rose-900 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              <form onSubmit={handleSwitchPin} className="space-y-4">
                <div>
                  <input
                    type="password"
                    maxLength={6}
                    placeholder="Enter PIN (e.g. 1234)"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    className="w-full text-center tracking-widest text-2xl font-black rounded-2xl border border-slate-300 bg-slate-50 py-3 font-mono text-slate-900 focus:outline-hidden dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-orange-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-orange-700 active:scale-98 transition flex items-center justify-center gap-2"
                >
                  <UserCheck className="h-4 w-4" />
                  <span>Switch Operator Profile</span>
                </button>
              </form>

              {/* Quick Role Badges List */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">Available Users & Roles</div>
                <div className="grid grid-cols-2 gap-2">
                  {users.map(u => (
                    <button
                      key={u.id}
                      onClick={() => setPinInput(u.pin)}
                      className="p-2 rounded-xl border border-slate-200 bg-slate-50 text-left hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 transition"
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{u.name}</div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                        <span className="capitalize">{u.role.replace('_', ' ')}</span>
                        <span className="font-bold text-orange-600">PIN: {u.pin}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'manage' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Registered Users</span>
                <button
                  onClick={() => setIsAddingUser(!isAddingUser)}
                  className="flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isAddingUser ? 'Cancel' : '+ New User'}</span>
                </button>
              </div>

              {isAddingUser && (
                <form onSubmit={handleCreateUser} className="rounded-2xl border border-orange-200 bg-orange-50/50 p-4 space-y-3 dark:border-orange-900 dark:bg-orange-950/30 animate-in fade-in">
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">User Full Name:</label>
                    <input
                      type="text"
                      placeholder="e.g. Supervisor Name"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Role:</label>
                      <select
                        value={newUserRole}
                        onChange={(e) => setNewUserRole(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      >
                        <option value="admin">Admin</option>
                        <option value="dispatch_manager">Dispatch Manager</option>
                        <option value="inward_storekeeper">Inward Storekeeper</option>
                        <option value="count_staff">Count Staff</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">Security PIN:</label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="e.g. 5555"
                        value={newUserPin}
                        onChange={(e) => setNewUserPin(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-mono font-bold text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-orange-600 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700"
                  >
                    Save User
                  </button>
                </form>
              )}

              {/* Users list with inline editing */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {users.map(u => (
                  <div key={u.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40">
                    {editingUserId === u.id ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-0.5">Name:</label>
                            <input
                              type="text"
                              value={editUserName}
                              onChange={(e) => setEditUserName(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 block mb-0.5">PIN:</label>
                            <input
                              type="text"
                              maxLength={6}
                              value={editUserPin}
                              onChange={(e) => setEditUserPin(e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono font-bold text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            onClick={() => setEditingUserId(null)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-100"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => {
                              if (editUserName.trim() && editUserPin.trim()) {
                                updateUser(u.id, { name: editUserName.trim(), pin: editUserPin.trim() });
                                setEditingUserId(null);
                              }
                            }}
                            className="rounded-lg bg-orange-600 px-3 py-1 text-xs font-bold text-white hover:bg-orange-700"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-white font-bold text-xs ${u.avatarColor}`}>
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{u.name}</span>
                              {u.id === currentUser.id && (
                                <span className="text-[9px] bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 font-bold px-1.5 py-0.2 rounded-sm">Active</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono capitalize">
                              {u.role.replace('_', ' ')} • PIN: <strong>{u.pin}</strong>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingUserId(u.id);
                              setEditUserName(u.name);
                              setEditUserPin(u.pin);
                            }}
                            className="text-slate-400 hover:text-orange-600 transition p-1"
                            title="Edit User Name & PIN"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {users.length > 1 && u.id !== currentUser.id && (
                            <button
                              onClick={() => deleteUser(u.id)}
                              className="text-slate-400 hover:text-rose-600 transition p-1"
                              title="Delete user"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'purge' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-900 dark:border-rose-950 dark:bg-rose-950/30 dark:text-rose-200">
                <div className="flex items-center gap-2 font-bold mb-1">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>Permanent Data Deletion & Wipe Options</span>
                </div>
                <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed">
                  Delete mock logs, unwanted physical counts, or clear order records without affecting the 1,421 master SKU catalog.
                </p>
              </div>

              {/* Data Summary Cards */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Logs/Txns</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5 font-mono">{transactions.length}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Location Counts</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5 font-mono">{locationStockEntries.length}</div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Dispatched SOs</div>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5 font-mono">{Object.keys(deductedSalesOrders).length}</div>
                </div>
              </div>

              {/* Granular Purge Actions */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => {
                    if (window.confirm(`Delete all ${transactions.length} inward, outward, and audit transactions? This cannot be undone.`)) {
                      clearTransactions();
                      setPurgeStatus('All transaction logs deleted successfully.');
                      setTimeout(() => setPurgeStatus(null), 4000);
                    }
                  }}
                  disabled={transactions.length === 0}
                  className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-800 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 disabled:opacity-40 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-rose-500" />
                    <span>Clear All Inward & Audit Transaction Logs</span>
                  </div>
                  <span className="text-[11px] font-mono font-normal text-slate-400">({transactions.length} logs)</span>
                </button>

                <button
                  onClick={() => {
                    if (window.confirm(`Delete all ${locationStockEntries.length} warehouse physical counts? Location stock ledger will be reset to empty.`)) {
                      clearAllLocationCounts();
                      setPurgeStatus('All warehouse location physical counts deleted successfully.');
                      setTimeout(() => setPurgeStatus(null), 4000);
                    }
                  }}
                  disabled={locationStockEntries.length === 0}
                  className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-800 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 disabled:opacity-40 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-rose-500" />
                    <span>Clear All Warehouse Location Counts</span>
                  </div>
                  <span className="text-[11px] font-mono font-normal text-slate-400">({locationStockEntries.length} entries)</span>
                </button>

                <button
                  onClick={() => {
                    if (window.confirm('Delete all dispatched Sales Orders history and deduction records?')) {
                      clearAllDispatchedOrders();
                      setPurgeStatus('All dispatched Sales Orders cleared.');
                      setTimeout(() => setPurgeStatus(null), 4000);
                    }
                  }}
                  disabled={Object.keys(deductedSalesOrders).length === 0}
                  className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 text-xs font-bold text-slate-800 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 disabled:opacity-40 transition dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-rose-500" />
                    <span>Clear Dispatched Sales Orders History</span>
                  </div>
                  <span className="text-[11px] font-mono font-normal text-slate-400">({Object.keys(deductedSalesOrders).length} orders)</span>
                </button>

                {/* Nuclear Option: Factory Clean Reset */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      if (window.confirm('FACTORY RESET: This will remove ALL mock transactions, clear all location counts, clear all dispatches, and reset database to genuine factory catalog. Continue?')) {
                        resetDatabaseClean();
                        setPurgeStatus('Factory Clean Reset completed! Pure 1,421 SKU catalog active with zero mock entries.');
                        setTimeout(() => setPurgeStatus(null), 5000);
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-xs font-black text-white hover:bg-rose-700 active:scale-98 transition shadow-sm"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Factory Clean Reset (Zero Fake Entries / Pure Master)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
