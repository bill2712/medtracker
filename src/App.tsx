/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Clock, CalendarPlus, Settings, Pill, CheckCircle2, Plus, X, Trash2, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Medication = {
  id: string;
  name: string;
  totalPills: number;
  pillsTaken: number;
  dosage: number;
  frequencyHours: number;
  lastTakenTime: string | null;
  history?: string[];
};

const defaultMeds: Medication[] = [
  {
    id: '1',
    name: 'Antibiotics (抗生素)',
    totalPills: 21,
    pillsTaken: 0,
    dosage: 1,
    frequencyHours: 8,
    lastTakenTime: null,
    history: [],
  },
  {
    id: '2',
    name: 'Ibrufen (布洛芬)',
    totalPills: 20,
    pillsTaken: 0,
    dosage: 1,
    frequencyHours: 6,
    lastTakenTime: null,
    history: [],
  },
  {
    id: '3',
    name: 'Telfast (退敏快)',
    totalPills: 10,
    pillsTaken: 0,
    dosage: 1,
    frequencyHours: 24,
    lastTakenTime: null,
    history: [],
  }
];

const getNextDoseTime = (med: Medication): Date | null => {
  const history = med.history || (med.lastTakenTime ? [med.lastTakenTime] : []);
  const lastTime = history.length > 0 ? history[history.length - 1] : null;
  if (!lastTime) return null;
  return new Date(new Date(lastTime).getTime() + med.frequencyHours * 60 * 60 * 1000);
};

const getRemainingDays = (med: Medication): number => {
  const pillsLeft = Math.max(0, med.totalPills - med.pillsTaken);
  if (pillsLeft === 0) return 0;
  const dosesLeft = pillsLeft / med.dosage;
  const hoursLeft = dosesLeft * med.frequencyHours;
  return +(hoursLeft / 24).toFixed(1);
};

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('zh-HK', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (date: Date) => {
  return date.toLocaleDateString('zh-HK', { month: 'short', day: 'numeric' });
};

const generateICS = (med: Medication) => {
  const nextDose = getNextDoseTime(med);
  if (!nextDose) {
    alert('請先服用一次藥物以計算下次服藥時間 (Please take a dose first to calculate next dose time)');
    return;
  }
  
  const endTime = new Date(nextDose.getTime() + 15 * 60 * 1000); // 15 mins
  
  const formatICSDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MedTracker//HK',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `DTSTART:${formatICSDate(nextDose)}`,
    `DTEND:${formatICSDate(endTime)}`,
    `SUMMARY:💊 食藥提醒: ${med.name}`,
    `DESCRIPTION:夠鐘食藥啦！需要服用 ${med.dosage} 粒 ${med.name}。`,
    'BEGIN:VALARM',
    'TRIGGER:-PT0M',
    'ACTION:DISPLAY',
    `DESCRIPTION:💊 食藥提醒: ${med.name}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Reminder_${med.name}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

function MedicationCard({ med, onTake, onEdit, onCalendar, onEditDose }: { med: Medication, onTake: () => void, onEdit: () => void, onCalendar: () => void, onEditDose: () => void }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  const nextDose = getNextDoseTime(med);
  const isCompleted = med.pillsTaken >= med.totalPills;
  const isEarly = nextDose ? now < nextDose : false;
  const canTake = !isCompleted && !isEarly;
  
  return (
    <div className={`bg-white rounded-2xl shadow-sm border ${isCompleted ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100'} p-5 mb-4`}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-800">{med.name}</h3>
          <p className="text-sm text-slate-500 mt-1">
            每次 {med.dosage} 粒 • 每 {med.frequencyHours} 小時一次
          </p>
        </div>
        <button onClick={onEdit} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors">
          <Settings size={20} />
        </button>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-600">進度 (已服/總數)</span>
          <span className="font-medium text-slate-800">{med.pillsTaken} / {med.totalPills} 粒</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
          <div 
            className={`h-2.5 rounded-full transition-all duration-500 ${isCompleted ? 'bg-emerald-400' : 'bg-emerald-500'}`}
            style={{ width: `${Math.min(100, (med.pillsTaken / med.totalPills) * 100)}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-slate-500 mt-2">
          <span>剩餘: {Math.max(0, med.totalPills - med.pillsTaken)} 粒</span>
          <span>預計剩餘: {getRemainingDays(med)} 日</span>
        </div>
      </div>

      {/* Next Dose Info */}
      {!isCompleted && (
        <div className={`rounded-xl p-3 mb-4 flex items-center gap-3 ${isEarly ? 'bg-amber-50' : 'bg-slate-50'}`}>
          <Clock className={isEarly ? "text-amber-500" : "text-indigo-500"} size={20} />
          <div>
            <p className={`text-xs ${isEarly ? 'text-amber-600/70' : 'text-slate-500'}`}>下次服藥時間</p>
            <p className={`text-sm font-medium ${isEarly ? 'text-amber-700' : 'text-slate-800'}`}>
              {nextDose ? `${formatDate(nextDose)} ${formatTime(nextDose)}` : '尚未開始服藥'}
            </p>
          </div>
        </div>
      )}

      {isCompleted && (
        <div className="bg-emerald-50 text-emerald-700 rounded-xl p-3 mb-4 flex items-center gap-3">
          <CheckCircle2 size={20} />
          <p className="text-sm font-medium">已完成所有療程</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button 
          onClick={onTake}
          disabled={!canTake}
          className={`flex-1 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors ${
            isCompleted ? 'bg-slate-200 text-slate-400' : 
            isEarly ? 'bg-amber-100 text-amber-600' : 
            'bg-emerald-500 hover:bg-emerald-600 text-white'
          }`}
        >
          <CheckCircle2 size={20} />
          {isCompleted ? '已完成' : isEarly ? '未到時間' : '確認服藥'}
        </button>
        
        <button 
          onClick={onEditDose}
          className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center transition-colors"
          title="修改/補加服藥紀錄"
        >
          <History size={20} />
        </button>

        {!isCompleted && (
          <button 
            onClick={onCalendar}
            className="px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center transition-colors"
            title="加入行事曆提醒"
          >
            <CalendarPlus size={20} />
          </button>
        )}
      </div>
    </div>
  );
}

const EditDoseModal = ({ med, onSave, onClose }: { med: Medication, onSave: (h: string[], p: number) => void, onClose: () => void }) => {
  const initialHistory = med.history || (med.lastTakenTime ? [med.lastTakenTime] : []);
  const [localHistory, setLocalHistory] = useState<string[]>(initialHistory);
  
  const formatForInput = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const handleTimeChange = (index: number, newTimeStr: string) => {
    if (!newTimeStr) return;
    const newTime = new Date(newTimeStr).toISOString();
    const updated = [...localHistory];
    updated[index] = newTime;
    setLocalHistory(updated);
  };

  const handleRemove = (index: number) => {
    const updated = localHistory.filter((_, i) => i !== index);
    setLocalHistory(updated);
  };

  const handleAddRecord = () => {
    const newTime = new Date().toISOString();
    setLocalHistory([...localHistory, newTime]);
  };

  const handleSave = () => {
    // Sort history chronologically
    const sortedHistory = [...localHistory].sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    
    // Calculate new pills taken based on difference in history length
    const diff = initialHistory.length - sortedHistory.length;
    const calculatedPills = med.pillsTaken - (diff * med.dosage);
    const newPillsTaken = Math.min(med.totalPills, Math.max(0, calculatedPills));
    
    onSave(sortedHistory, newPillsTaken);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="p-4 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">服藥紀錄 ({localHistory.length})</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto space-y-4 grow">
          {localHistory.length === 0 ? (
            <p className="text-center text-slate-500 py-4">暫無服藥紀錄</p>
          ) : (
            localHistory.map((isoTime, index) => (
              <div key={index} className="flex items-center gap-2 bg-slate-50 p-3 rounded-xl">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-500 mb-1">第 {index + 1} 次服藥</label>
                  <input 
                    type="datetime-local" 
                    value={formatForInput(isoTime)}
                    onChange={e => handleTimeChange(index, e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
                <button 
                  onClick={() => handleRemove(index)}
                  className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-4"
                  title="移除此紀錄"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
          
          <button
            onClick={handleAddRecord}
            className="w-full py-3 border-2 border-dashed border-slate-200 text-slate-500 rounded-xl hover:bg-slate-50 hover:border-emerald-300 hover:text-emerald-600 transition-colors flex items-center justify-center gap-2 mt-2"
          >
            <Plus size={18} /> 補加服藥紀錄
          </button>

          <p className="text-xs text-slate-500 mt-2">
            修改時間後，系統會自動重新計算下一次的服藥時間。新增或移除紀錄會自動增減已服用的數量。
          </p>
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50 shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl text-sm font-medium transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSave}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
          >
            儲存
          </button>
        </div>
      </motion.div>
    </div>
  );
}

const EditModal = ({ med, onSave, onClose, onDelete }: { med: Medication, onSave: (m: Medication) => void, onClose: () => void, onDelete: (id: string) => void }) => {
  const [formData, setFormData] = useState<Medication>(med);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl w-full max-w-md overflow-hidden"
      >
        <div className="p-4 border-b border-slate-100 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-800">
            {med.id ? '編輯藥物' : '新增藥物'}
          </h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-full">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">藥物名稱</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">總數量 (粒)</label>
              <input 
                type="number" 
                value={formData.totalPills}
                onChange={e => setFormData({...formData, totalPills: parseInt(e.target.value) || 0})}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">已服數量 (粒)</label>
              <input 
                type="number" 
                value={formData.pillsTaken}
                onChange={e => setFormData({...formData, pillsTaken: parseInt(e.target.value) || 0})}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">每次劑量 (粒)</label>
              <input 
                type="number" 
                value={formData.dosage}
                onChange={e => setFormData({...formData, dosage: parseInt(e.target.value) || 0})}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">頻率 (每X小時)</label>
              <input 
                type="number" 
                value={formData.frequencyHours}
                onChange={e => setFormData({...formData, frequencyHours: parseInt(e.target.value) || 0})}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 flex justify-between bg-slate-50">
          {med.id ? (
            <button 
              onClick={() => onDelete(med.id)}
              className="text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1"
            >
              <Trash2 size={16} /> 刪除
            </button>
          ) : <div></div>}
          <div className="flex gap-2">
            <button 
              onClick={onClose}
              className="px-4 py-2 text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-xl text-sm font-medium transition-colors"
            >
              取消
            </button>
            <button 
              onClick={() => onSave(formData)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              儲存
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default function App() {
  const [medications, setMedications] = useState<Medication[]>(() => {
    const saved = localStorage.getItem('medications');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return defaultMeds;
  });

  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [editingDoseMed, setEditingDoseMed] = useState<Medication | null>(null);

  useEffect(() => {
    localStorage.setItem('medications', JSON.stringify(medications));
  }, [medications]);

  const handleTakeDose = (id: string) => {
    setMedications(prev => prev.map(med => {
      if (med.id === id) {
        const newTaken = Math.min(med.totalPills, med.pillsTaken + med.dosage);
        const now = new Date().toISOString();
        const newHistory = [...(med.history || (med.lastTakenTime ? [med.lastTakenTime] : [])), now];
        return {
          ...med,
          pillsTaken: newTaken,
          lastTakenTime: now,
          history: newHistory
        };
      }
      return med;
    }));
  };

  const handleUpdateDoseHistory = (id: string, newHistory: string[], newPillsTaken: number) => {
    setMedications(prev => prev.map(med => {
      if (med.id === id) {
        return {
          ...med,
          history: newHistory,
          pillsTaken: newPillsTaken,
          lastTakenTime: newHistory.length > 0 ? newHistory[newHistory.length - 1] : null
        };
      }
      return med;
    }));
    setEditingDoseMed(null);
  };

  const handleSaveEdit = (updatedMed: Medication) => {
    setMedications(prev => {
      if (!updatedMed.id) {
        return [...prev, { ...updatedMed, id: crypto.randomUUID() }];
      }
      const exists = prev.find(m => m.id === updatedMed.id);
      if (exists) {
        return prev.map(m => m.id === updatedMed.id ? updatedMed : m);
      } else {
        return [...prev, updatedMed];
      }
    });
    setEditingMed(null);
  };

  const handleDelete = (id: string) => {
    setMedications(prev => prev.filter(m => m.id !== id));
    setEditingMed(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-600">
            <Pill size={24} />
            <h1 className="text-xl font-bold">MedTracker</h1>
          </div>
          <button 
            onClick={() => setEditingMed({ id: '', name: '', totalPills: 0, pillsTaken: 0, dosage: 1, frequencyHours: 8, lastTakenTime: null, history: [] })}
            className="p-2 bg-emerald-50 text-emerald-600 rounded-full hover:bg-emerald-100 transition-colors"
          >
            <Plus size={20} />
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4">
        <AnimatePresence>
          {medications.map(med => (
            <motion.div
              key={med.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <MedicationCard 
                med={med} 
                onTake={() => handleTakeDose(med.id)}
                onEdit={() => setEditingMed(med)}
                onCalendar={() => generateICS(med)}
                onEditDose={() => setEditingDoseMed(med)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        
        {medications.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            <Pill size={48} className="mx-auto mb-4 opacity-20" />
            <p>目前沒有藥物記錄</p>
            <p className="text-sm mt-1">點擊右上角新增藥物</p>
          </div>
        )}
      </main>

      {editingMed && (
        <EditModal 
          med={editingMed} 
          onSave={handleSaveEdit} 
          onClose={() => setEditingMed(null)} 
          onDelete={handleDelete}
        />
      )}

      {editingDoseMed && (
        <EditDoseModal
          med={editingDoseMed}
          onSave={(history, pillsTaken) => handleUpdateDoseHistory(editingDoseMed.id, history, pillsTaken)}
          onClose={() => setEditingDoseMed(null)}
        />
      )}
    </div>
  );
}
