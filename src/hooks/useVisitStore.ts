import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Appointment, DoctorNote } from '../types';
import {
  loadAppointments,
  loadNotes,
  normalizeAppointments,
  normalizeNotes,
  saveAppointments,
  saveNotes,
  STORAGE_KEYS,
} from '../lib/storage';

const byTime = (a: Appointment, b: Appointment) => Date.parse(a.time) - Date.parse(b.time);

export function useVisitStore() {
  const [appointments, setAppointments] = useState<Appointment[]>(loadAppointments);
  const [notes, setNotes] = useState<DoctorNote[]>(loadNotes);
  const apptsRef = useRef(appointments);
  apptsRef.current = appointments;
  const notesRef = useRef(notes);
  notesRef.current = notes;

  useEffect(() => saveAppointments(appointments), [appointments]);
  useEffect(() => saveNotes(notes), [notes]);

  // Keep several open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (!e.newValue) return;
      try {
        if (e.key === STORAGE_KEYS.appts) setAppointments(normalizeAppointments(JSON.parse(e.newValue)));
        if (e.key === STORAGE_KEYS.notes) setNotes(normalizeNotes(JSON.parse(e.newValue)));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const upsertAppt = useCallback((appt: Appointment) => {
    setAppointments((prev) =>
      (prev.some((a) => a.id === appt.id) ? prev.map((a) => (a.id === appt.id ? appt : a)) : [...prev, appt]).sort(byTime),
    );
  }, []);

  /** Removes an appointment; its discussed notes go back to the open list. Returns what is needed to undo. */
  const removeAppt = useCallback((id: string) => {
    const appt = apptsRef.current.find((a) => a.id === id);
    if (!appt) return null;
    const linked = notesRef.current.filter((n) => n.apptId === id);
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    setNotes((prev) => prev.map((n) => (n.apptId === id ? { ...n, resolved: undefined, apptId: undefined } : n)));
    return { appt, linked };
  }, []);

  const restoreAppt = useCallback((appt: Appointment, linked: DoctorNote[]) => {
    setAppointments((prev) => (prev.some((a) => a.id === appt.id) ? prev : [...prev, appt].sort(byTime)));
    const ids = new Set(linked.map((n) => n.id));
    setNotes((prev) => prev.map((n) => (ids.has(n.id) ? linked.find((l) => l.id === n.id)! : n)));
  }, []);

  const addNote = useCallback((note: DoctorNote) => setNotes((prev) => [note, ...prev]), []);

  const updateNote = useCallback(
    (id: string, patch: Partial<DoctorNote>) => setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n))),
    [],
  );

  const removeNote = useCallback((id: string) => {
    const index = notesRef.current.findIndex((n) => n.id === id);
    if (index < 0) return null;
    const note = notesRef.current[index];
    setNotes((prev) => prev.filter((n) => n.id !== id));
    return { note, index };
  }, []);

  const restoreNote = useCallback((note: DoctorNote, index: number) => {
    setNotes((prev) => {
      if (prev.some((n) => n.id === note.id)) return prev;
      const next = [...prev];
      next.splice(Math.min(index, next.length), 0, note);
      return next;
    });
  }, []);

  /** Ticks a note as discussed at a visit, or puts it back on the open list. */
  const toggleDiscussed = useCallback((noteId: string, apptId: string, discussed: boolean) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId ? (discussed ? { ...n, resolved: true, apptId } : { ...n, resolved: undefined, apptId: undefined }) : n,
      ),
    );
  }, []);

  const replaceAll = useCallback((appts: Appointment[], newNotes: DoctorNote[]) => {
    setAppointments([...appts].sort(byTime));
    setNotes(newNotes);
  }, []);

  return useMemo(
    () => ({
      appointments,
      notes,
      upsertAppt,
      removeAppt,
      restoreAppt,
      addNote,
      updateNote,
      removeNote,
      restoreNote,
      toggleDiscussed,
      replaceAll,
    }),
    [appointments, notes, upsertAppt, removeAppt, restoreAppt, addNote, updateNote, removeNote, restoreNote, toggleDiscussed, replaceAll],
  );
}

export type VisitStore = ReturnType<typeof useVisitStore>;
