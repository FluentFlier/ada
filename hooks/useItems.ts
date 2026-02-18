import { create } from 'zustand';

interface ItemsState {
    items: any[];
    addItem: (item: any) => void;
}

export const useItems = create<ItemsState>((set) => ({
    items: [],
    addItem: (item) => set((state) => ({ items: [...state.items, item] })),
}));
