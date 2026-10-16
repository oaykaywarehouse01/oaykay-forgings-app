import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, 
  KeyRound, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Package, 
  Truck, 
  Layers, 
  Boxes,
  Delete,
  RotateCcw
} from 'lucide-react';
import { useInventoryStore } from '../store/useInventoryStore';
import { AppUser } from '../types/inventory';
import { ROLE_CONFIGS, getDefaultModuleForRole } from '../lib/userPermissions';

export const LoginScreen: React.FC = () => {
  const { users, setCurrentUser, setActiveModule } = useInventoryStore();

  const [selectedUser, setSelectedUser] = useState<AppUser>(users[0] || null);
  const [pinInput, setPinInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successAnimation, setSuccessAnimation] = useState(false);

  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus PIN input whenever selectedUser changes
    setPinInput('');
    setErrorMessage(null);
    setTimeout(() => {
      pinInputRef.current?.focus();
    }, 100);
  }, [selectedUser]);

  const handleKeypadPress = (val: string) => {
    setErrorMessage(null);
    if (val === 'CLEAR') {
      setPinInput('');
    } else if (val === 'BACK') {
      setPinInput(prev => prev.slice(0, -1));
    } else {
      if (pinInput.length < 6) {
        const next = pinInput + val;
        setPinInput(next);
        if (next.length === (selectedUser?.pin?.length || 4)) {
          validateAndLogin(next);
        }
      }
    }
  };

  const validateAndLogin = (pinToTest: string) => {
    if (!selectedUser) return;
    if (pinToTest.trim() === selectedUser.pin.trim()) {
      setSuccessAnimation(true);
      setTimeout(() => {
        setCurrentUser(selectedUser);
        setActiveModule(getDefaultModuleForRole(selectedUser.role));
      }, 400);
    } else {
      setErrorMessage(`Incorrect 4-digit PIN for ${selectedUser.name}. Please try again.`);
      setPinInput('');
      pinInputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateAndLogin(pinInput);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return ShieldCheck;
      case 'dispatch_manager': return Truck;
      case 'inward_storekeeper': return Package;
      case 'count_staff': return Boxes;
      default: return Layers;
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-radial from-slate-100 via-slate-200 to-slate-300 dark:from-slate-900 dark:via-slate-950 dark:to-black p-4 select-none">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 transition-all">
        
        {/* Company Header */}
        <div className="flex flex-col items-center text-center pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-10 w-10 rounded-2xl bg-orange-600 flex items-center justify-center text-white font-black text-xl shadow-md">
              OK
            </div>
            <div className="text-left leading-tight">
              <span className="text-base font-black tracking-tight text-slate-900 dark:text-white block">
                OAYKAY FORGINGS
              </span>
              <span className="text-[10px] font-bold text-orange-600 uppercase tracking-widest block">
                Warehouse Station V3.0
              </span>
            </div>
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
            Staff Sign-In & PIN Verification
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Select your workstation profile below to enter your 4-digit security PIN.
          </p>
        </div>

        {/* User Profile Cards Grid */}
        <div className="mt-5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            Select Operator Profile:
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {users.map(u => {
              const isSelected = selectedUser?.id === u.id;
              const config = ROLE_CONFIGS[u.role];
              const Icon = getRoleIcon(u.role);

              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUser(u)}
                  className={`flex flex-col items-center text-center p-3 rounded-2xl border-2 transition-all ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50/80 dark:bg-orange-950/40 shadow-sm scale-[1.02]'
                      : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/40'
                  }`}
                >
                  <div className={`h-11 w-11 rounded-2xl flex items-center justify-center text-white font-black text-base shadow-xs mb-2 ${u.avatarColor || 'bg-slate-700'}`}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate w-full">
                    {u.name}
                  </div>
                  <span className={`mt-1 text-[9px] font-bold uppercase rounded-md px-1.5 py-0.5 truncate max-w-full ${config?.badgeBg || 'bg-slate-100'} ${config?.badgeText || 'text-slate-700'}`}>
                    {config?.shortLabel || u.role}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected User Action & PIN Pad */}
        {selectedUser && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center text-white font-bold text-xs ${selectedUser.avatarColor || 'bg-slate-700'}`}>
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {selectedUser.name}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {ROLE_CONFIGS[selectedUser.role]?.label || selectedUser.role}
                  </div>
                </div>
              </div>

              <div className="text-[10px] font-mono font-bold text-orange-600 bg-orange-50 dark:bg-orange-950 px-2 py-1 rounded-lg border border-orange-200 dark:border-orange-900">
                Default PIN: {selectedUser.pin}
              </div>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-300 p-2.5 text-xs font-bold text-rose-900 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-200 animate-shake">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* PIN Input Box */}
            <div className="relative">
              <input
                ref={pinInputRef}
                type="password"
                maxLength={6}
                value={pinInput}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setPinInput(val);
                  setErrorMessage(null);
                  if (val.length === selectedUser.pin.length) {
                    validateAndLogin(val);
                  }
                }}
                placeholder="••••"
                className="w-full text-center tracking-[1em] text-3xl font-black rounded-2xl border-2 border-slate-300 bg-white py-3.5 font-mono text-slate-900 focus:outline-hidden focus:border-orange-500 dark:bg-slate-800 dark:border-slate-700 dark:text-white transition shadow-inner"
                autoFocus
              />
              <KeyRound className="h-5 w-5 text-slate-400 absolute left-4 top-4 pointer-events-none" />
            </div>

            {/* Touch On-Screen Keypad for Godown Tablets / Screens */}
            <div className="grid grid-cols-3 gap-2 pt-1 max-w-xs mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                <button
                  type="button"
                  key={num}
                  onClick={() => handleKeypadPress(num)}
                  className="py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-95 text-base font-black font-mono text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white transition shadow-2xs"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleKeypadPress('CLEAR')}
                className="py-3 rounded-xl border border-slate-200 bg-rose-50 hover:bg-rose-100 active:scale-95 text-xs font-black text-rose-700 dark:border-rose-900 dark:bg-rose-950/60 dark:text-rose-300 transition"
                title="Clear PIN"
              >
                C
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="py-3 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-95 text-base font-black font-mono text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-white transition shadow-2xs"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('BACK')}
                className="py-3 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 active:scale-95 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-200 transition flex items-center justify-center"
                title="Backspace"
              >
                ⌫
              </button>
            </div>

            {/* Login Submit Button */}
            <button
              type="submit"
              disabled={successAnimation}
              className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-black text-white shadow-md transition active:scale-98 ${
                successAnimation
                  ? 'bg-emerald-600'
                  : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              {successAnimation ? (
                <>
                  <CheckCircle2 className="h-5 w-5 animate-bounce" />
                  <span>Verified! Opening Workstation...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Sign In as {selectedUser.name}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
