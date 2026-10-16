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
  RotateCcw,
  LogOut,
  Sparkles
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { AppUser, UserRole } from '../types/inventory';
import { ROLE_CONFIGS } from '../lib/userPermissions';

export const UserManagementModal: React.FC = () => {
  const { 
    isUserManagementModalOpen, 
    setUserManagementModalOpen, 
    users, 
    currentUser, 
    setCurrentUserByPin,
    logout,
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

  const [activeTab, setActiveTab] = useState<'switch' | 'manage' | 'purge'>('manage');
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [switchSuccess, setSwitchSuccess] = useState<string | null>(null);
  const [purgeStatus, setPurgeStatus] = useState<string | null>(null);

  // Edit Active User Name inline
  const [isEditingCurName, setIsEditingCurName] = useState(false);
  const [curNameInput, setCurNameInput] = useState(currentUser?.name || '');

  // Edit another user state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserRole, setEditUserRole] = useState<UserRole>('count_staff');
  const [editUserPin, setEditUserPin] = useState('');

  // New user form state (Strictly 3 fields: Name, Role, 4-digit PIN)
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('count_staff');
  const [newUserPin, setNewUserPin] = useState('');

  if (!isUserManagementModalOpen) return null;

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
      }, 800);
    } else {
      setPinError(res.message);
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserPin.trim()) return;

    const colors = [
      'bg-orange-600', 
      'bg-emerald-600', 
      'bg-indigo-600', 
      'bg-amber-600', 
      'bg-purple-600', 
      'bg-rose-600', 
      'bg-cyan-600'
    ];
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

  const handleLogoutClick = () => {
    setUserManagementModalOpen(false);
    logout();
  };

  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in">
      <div 
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl transition-all dark:border-slate-800 dark:bg-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-11 w-11 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-sm ${currentUser?.avatarColor || 'bg-purple-600'}`}>
              {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div>
              {isEditingCurName ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <input
                    type="text"
                    value={curNameInput}
                    onChange={(e) => setCurNameInput(e.target.value)}
                    className="rounded-lg border border-orange-400 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 dark:bg-slate-800 dark:text-white"
                    placeholder="Your Name (e.g. Girish)"
                    autoFocus
                  />
                  <button
                    onClick={() => {
                      if (curNameInput.trim() && currentUser) {
                        updateUser(currentUser.id, { name: curNameInput.trim() });
                        setIsEditingCurName(false);
                      }
                    }}
                    className="rounded-lg bg-emerald-600 p-1.5 text-white hover:bg-emerald-700 transition"
                    title="Save Display Name"
                  >
                    <Check className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setCurNameInput(currentUser?.name || '');
                      setIsEditingCurName(false);
                    }}
                    className="rounded-lg bg-slate-200 p-1.5 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300"
                    title="Cancel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900 dark:text-white">
                    {currentUser?.name || 'Guest User'}
                  </span>
                  {currentUser && (
                    <button
                      onClick={() => {
                        setCurNameInput(currentUser.name);
                        setIsEditingCurName(true);
                      }}
                      className="text-slate-400 hover:text-orange-600 transition p-0.5"
                      title="Edit Display Name"
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    currentUser?.role === 'admin'
                      ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}>
                    {currentUser ? ROLE_CONFIGS[currentUser.role]?.shortLabel || currentUser.role : 'Logged Out'}
                  </span>
                </div>
              )}
              <div className="text-xs text-slate-400">Manage Staff Accounts & Security</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLogoutClick}
              className="flex items-center gap-1 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 transition"
              title="Logout from this device"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
            <button
              onClick={() => setUserManagementModalOpen(false)}
              className="rounded-xl border border-slate-200 p-1.5 text-xs text-slate-400 hover:text-slate-600 dark:border-slate-700 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 pt-3 space-x-6 text-xs font-bold">
          <button
            onClick={() => setActiveTab('manage')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'manage'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Staff Users ({users.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('switch')}
            className={`pb-2.5 flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'switch'
                ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>PIN Switch</span>
          </button>

          {isAdmin && (
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

          {/* TAB 1: 3-FIELD USER MANAGEMENT (ADMIN / SUPERVISOR) */}
          {activeTab === 'manage' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Staff Accounts & 4-Digit PINs
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Each user has 1 role and 1 security PIN for easy touchscreen or keyboard entry.
                  </p>
                </div>

                <button
                  onClick={() => setIsAddingUser(!isAddingUser)}
                  className="flex items-center gap-1.5 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-xl shadow-xs transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{isAddingUser ? 'Close Form' : '+ Add Staff'}</span>
                </button>
              </div>

              {/* 3-Field Add User Form */}
              {isAddingUser && (
                <form 
                  onSubmit={handleCreateUser} 
                  className="rounded-2xl border-2 border-orange-400 bg-orange-50/40 p-4 space-y-3 dark:border-orange-900 dark:bg-orange-950/20 animate-in fade-in"
                >
                  <div className="flex items-center justify-between border-b border-orange-200 dark:border-orange-900/50 pb-2">
                    <span className="text-xs font-black text-orange-900 dark:text-orange-200">
                      New Staff User (3 Fields Only)
                    </span>
                    <span className="text-[10px] text-orange-700 dark:text-orange-300 font-mono">
                      Step 1/1
                    </span>
                  </div>

                  {/* Field 1: Staff Name */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      1. Staff Name:
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Girish, Ramesh, Suresh, Aman"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 placeholder:font-normal dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      required
                      autoFocus
                    />
                  </div>

                  {/* Field 2: Role Selection (4 Simple Roles) */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      2. Role (Pick 1 of 4):
                    </label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    >
                      <option value="admin">Admin (Full Access — All Modules & Live Sync)</option>
                      <option value="dispatch_manager">Dispatch (SO & Packing Box Labels)</option>
                      <option value="inward_storekeeper">Inward (Stock In / Out Entry & Logs)</option>
                      <option value="count_staff">Location Counter (Racks, Pallets & Bins Only)</option>
                    </select>
                    <div className="mt-1 text-[11px] text-slate-500 italic bg-white/70 dark:bg-slate-800/70 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                      ℹ️ {ROLE_CONFIGS[newUserRole].description}
                    </div>
                  </div>

                  {/* Field 3: 4-Digit PIN */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      3. 4-Digit PIN:
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 1234, 2222, 3333, 4444"
                      value={newUserPin}
                      onChange={(e) => setNewUserPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-mono font-black text-center tracking-widest text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-xl bg-orange-600 py-2.5 text-xs font-black text-white shadow-xs hover:bg-orange-700 active:scale-98 transition flex items-center justify-center gap-1.5"
                  >
                    <Check className="h-4 w-4" />
                    <span>Save Staff User</span>
                  </button>
                </form>
              )}

              {/* Users list with inline 3-field editing */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {users.map(u => {
                  const roleConfig = ROLE_CONFIGS[u.role] || ROLE_CONFIGS.count_staff;
                  const isCur = u.id === currentUser?.id;

                  return (
                    <div 
                      key={u.id} 
                      className={`p-3 rounded-2xl border transition ${
                        isCur 
                          ? 'border-orange-300 bg-orange-50/30 dark:border-orange-900/60 dark:bg-orange-950/20' 
                          : 'border-slate-200 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-800/40'
                      }`}
                    >
                      {editingUserId === u.id ? (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 block mb-0.5">1. Name:</label>
                              <input
                                type="text"
                                value={editUserName}
                                onChange={(e) => setEditUserName(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 block mb-0.5">2. Role:</label>
                              <select
                                value={editUserRole}
                                onChange={(e) => setEditUserRole(e.target.value as UserRole)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                              >
                                <option value="admin">Admin</option>
                                <option value="dispatch_manager">Dispatch</option>
                                <option value="inward_storekeeper">Inward</option>
                                <option value="count_staff">Location Counter</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 block mb-0.5">3. 4-Digit PIN:</label>
                              <input
                                type="text"
                                maxLength={6}
                                value={editUserPin}
                                onChange={(e) => setEditUserPin(e.target.value.replace(/\D/g, ''))}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-mono font-bold text-center tracking-wider text-slate-900 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                            <button
                              onClick={() => setEditingUserId(null)}
                              className="rounded-lg border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:bg-slate-100"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                if (editUserName.trim() && editUserPin.trim()) {
                                  updateUser(u.id, { 
                                    name: editUserName.trim(), 
                                    role: editUserRole,
                                    pin: editUserPin.trim() 
                                  });
                                  setEditingUserId(null);
                                }
                              }}
                              className="rounded-lg bg-orange-600 px-3 py-1 text-xs font-bold text-white hover:bg-orange-700"
                            >
                              Save Changes
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 shadow-xs ${u.avatarColor || 'bg-slate-700'}`}>
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span>{u.name}</span>
                                {isCur && (
                                  <span className="text-[9px] bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 font-bold px-1.5 py-0.2 rounded-sm">
                                    Current
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${roleConfig.badgeBg} ${roleConfig.badgeText}`}>
                                  {roleConfig.label}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500 font-bold">
                                  PIN: <span className="text-slate-800 dark:text-slate-200">{u.pin}</span>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingUserId(u.id);
                                setEditUserName(u.name);
                                setEditUserRole(u.role);
                                setEditUserPin(u.pin);
                              }}
                              className="text-slate-400 hover:text-orange-600 transition p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Edit User Name, Role, & PIN"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>

                            {users.length > 1 && !isCur && (
                              <button
                                onClick={() => {
                                  if (window.confirm(`Delete user "${u.name}"?`)) {
                                    deleteUser(u.id);
                                  }
                                }}
                                className="text-slate-400 hover:text-rose-600 transition p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                title="Delete user"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: PIN SWITCH / QUICK OPERATOR LOGIN */}
          {activeTab === 'switch' && (
            <div className="space-y-5">
              <div className="text-center">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  Switch Active Operator Profile
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Enter your 4-digit security PIN to quickly switch roles or click any profile below.
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

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-orange-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-orange-700 active:scale-98 transition flex items-center justify-center gap-2"
                  >
                    <UserCheck className="h-4 w-4" />
                    <span>Switch Operator</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLogoutClick}
                    className="w-full rounded-xl bg-rose-600 py-3 text-xs font-bold text-white shadow-xs hover:bg-rose-700 active:scale-98 transition flex items-center justify-center gap-2"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Lock / Logout</span>
                  </button>
                </div>
              </form>

              {/* Quick User Cards */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="text-[10px] font-bold text-slate-400 uppercase mb-2">
                  Select User Card to Auto-Fill PIN:
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {users.map(u => (
                    <button
                      key={u.id}
                      onClick={() => setPinInput(u.pin)}
                      className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 text-left hover:border-orange-400 hover:bg-orange-50/50 dark:border-slate-700 dark:bg-slate-800 transition"
                    >
                      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{u.name}</div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                        <span className="capitalize">{ROLE_CONFIGS[u.role]?.shortLabel || u.role}</span>
                        <span className="font-bold text-orange-600">PIN: {u.pin}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DATA DELETE & RESET (ADMIN ONLY) */}
          {activeTab === 'purge' && isAdmin && (
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
