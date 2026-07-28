// Utility functions for Web & Capacitor Native Notifications, Audio chimes, and In-App Toasts
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

export type ToastType = 'success' | 'info' | 'warning' | 'error';

export interface ToastEventDetail {
  id: string;
  message: string;
  type: ToastType;
}

export const isCapacitorNative = () => {
  return Capacitor.isNativePlatform();
};

export const getNotificationPermissionStatus = (): 'granted' | 'denied' | 'default' | 'unsupported' => {
  if (Capacitor.isNativePlatform()) {
    return 'granted';
  }
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as 'granted' | 'denied' | 'default';
};

export const requestNotificationPermission = async (): Promise<'granted' | 'denied' | 'default' | 'unsupported'> => {
  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display === 'granted') {
        triggerWebNotification('BillMax App Active 🔔', 'Native app notifications activated!');
        playNotificationSound();
        return 'granted';
      }
      return perm.display === 'denied' ? 'denied' : 'default';
    } catch (err) {
      console.warn('Error requesting Capacitor Local Notification permissions:', err);
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      triggerWebNotification('BillMax Notifications Active 🔔', 'Aapko sabhi important billing aur stock alerts milti rahengi.');
      playNotificationSound();
    }
    return permission as 'granted' | 'denied' | 'default';
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return getNotificationPermissionStatus();
  }
};

export const triggerWebNotification = async (title: string, body: string, iconUrl?: string) => {
  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title,
            body,
            id: Math.floor(Math.random() * 1000000),
            schedule: { at: new Date(Date.now() + 100) },
            extra: null,
          },
        ],
      });
      return;
    } catch (e) {
      console.warn('Capacitor LocalNotifications schedule error:', e);
    }
  }

  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      const notification = new Notification(title, {
        body,
        icon: iconUrl || '/logo.png',
        badge: '/logo.png',
        tag: 'billmax-notification-' + Date.now(),
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } catch (e) {
      console.warn('Browser failed to trigger Web Notification:', e);
    }
  }
};

export const playNotificationSound = () => {
  if (Capacitor.isNativePlatform()) {
    try {
      Haptics.impact({ style: ImpactStyle.Medium });
    } catch (e) {}
  }
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const audioCtx = new AudioContextClass();
    
    // Friendly two-tone chime
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.15, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = audioCtx.currentTime;
    playTone(587.33, now, 0.12); // D5
    playTone(880.00, now + 0.12, 0.22); // A5
  } catch (e) {
    // Ignore audio autoplay restrictions gracefully
  }
};

export const showToast = (message: string, type: ToastType = 'info', triggerWeb: boolean = false) => {
  if (typeof window === 'undefined') return;
  
  const detail: ToastEventDetail = {
    id: Math.random().toString(36).substring(2, 9),
    message,
    type,
  };

  const event = new CustomEvent<ToastEventDetail>('billmax-toast', { detail });
  window.dispatchEvent(event);

  if (type === 'success' || type === 'warning' || type === 'error') {
    playNotificationSound();
  }

  if (triggerWeb && (type === 'warning' || type === 'error' || type === 'success')) {
    triggerWebNotification('BillMax Alert', message);
  }
};
