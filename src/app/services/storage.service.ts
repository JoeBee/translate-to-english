import { Injectable } from '@angular/core';

export interface UserPreferences {
  selectedLanguage: string;
  enableTextToSpeech?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly PREFERENCES_KEY = 'translate_preferences';
  private readonly HISTORY_KEY = 'translate_history';

  getPreferences(): UserPreferences {
    try {
      const stored = localStorage.getItem(this.PREFERENCES_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
    return {
      selectedLanguage: '',
      enableTextToSpeech: false
    };
  }

  savePreferences(preferences: UserPreferences): void {
    try {
      localStorage.setItem(this.PREFERENCES_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.error('Error saving preferences:', error);
    }
  }

  getHistory(): any[] {
    try {
      const stored = localStorage.getItem(this.HISTORY_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
    return [];
  }

  addToHistory(entry: any): void {
    try {
      const history = this.getHistory();
      history.unshift(entry);
      // Keep only last 50 entries
      if (history.length > 50) {
        history.splice(50);
      }
      localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Error saving history:', error);
    }
  }

  clearHistory(): void {
    try {
      localStorage.removeItem(this.HISTORY_KEY);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  }
}

