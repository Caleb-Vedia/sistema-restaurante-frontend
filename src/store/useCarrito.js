import { create } from 'zustand'

const useCarrito = create((set, get) => ({
  items: [],
  mesa: null,

  setMesa: (mesa) => set({ mesa }),

  agregarItem: (producto) => {
    const { items } = get()
    const existente = items.find(i => i.id === producto.id)
    if (existente) {
      set({ items: items.map(i => i.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i) })
    } else {
      set({ items: [...items, { ...producto, cantidad: 1 }] })
    }
  },

  quitarItem: (productoId) => {
    const { items } = get()
    const item = items.find(i => i.id === productoId)
    if (!item) return
    if (item.cantidad === 1) {
      set({ items: items.filter(i => i.id !== productoId) })
    } else {
      set({ items: items.map(i => i.id === productoId ? { ...i, cantidad: i.cantidad - 1 } : i) })
    }
  },

  limpiarCarrito: () => set({ items: [] }),
}))

export default useCarrito