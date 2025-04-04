import { StoreKey } from "../constant";
import { createPersistStore } from "../utils/store";

interface WelcomeState {
  hasShownWelcome: boolean;
  lastVisitDate: string;
}

const DEFAULT_WELCOME_STATE: WelcomeState = {
  hasShownWelcome: false,
  lastVisitDate: new Date().toISOString().split('T')[0], // 当前日期，格式如"2025-01-01"
};

export const useWelcomeStore = createPersistStore(
  { ...DEFAULT_WELCOME_STATE },
  
  (set, get) => ({
    setShownWelcome: (shown: boolean) => {
      set({ hasShownWelcome: shown });
    },
    
    updateLastVisitDate: () => {
      const today = new Date().toISOString().split('T')[0];
      set({ lastVisitDate: today });
    },
    
    shouldShowWelcome: () => {
      const { hasShownWelcome, lastVisitDate } = get();
      
      // 判断是否是新的一天
      const today = new Date().toISOString().split('T')[0];
      const isNewDay = today !== lastVisitDate;
      
      // 如果从未显示过欢迎弹窗，或者是新的一天
      if (!hasShownWelcome || isNewDay) {
        return true;
      }
      
      return false;
    }
  }),
  
  {
    name: StoreKey.Welcome,
    version: 1,
  }
); 