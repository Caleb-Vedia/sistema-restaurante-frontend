import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const MOCK_INICIAL = [
  {
    id: 1, mesa: 'mesa-3', hora: '21:15', estado: 'pendiente', nuevo: false,
    items: [{ nombre: 'Pique Macho', cantidad: 2 }, { nombre: 'Silpancho', cantidad: 1 }],
  },
  {
    id: 2, mesa: 'mesa-7', hora: '21:08', estado: 'preparando', nuevo: false,
    items: [{ nombre: 'Anticuchos', cantidad: 3 }, { nombre: 'Chicharrón de Cerdo', cantidad: 1 }],
  },
  {
    id: 3, mesa: 'mesa-1', hora: '20:55', estado: 'listo', nuevo: false,
    items: [{ nombre: 'Majadito', cantidad: 2 }],
  },
]

const usePedidos = create(
  persist(
    (set, get) => ({
      pedidos: MOCK_INICIAL,

      agregarPedido: (mesa, items) => {
        const hora = new Date().toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })
        const nuevo = {
          id: Date.now(),
          mesa,
          hora,
          estado: 'pendiente',
          nuevo: true,
          items: items.map(i => ({ nombre: i.nombre, cantidad: i.cantidad })),
        }
        set({ pedidos: [nuevo, ...get().pedidos] })
      },

      cambiarEstado: (id, estado) => {
        set({
          pedidos: get().pedidos.map(p =>
            p.id === id ? { ...p, estado, nuevo: false } : p
          ),
        })
      },
    }),
    { name: 'pedidos-lacasadelgordo' }
  )
)

export default usePedidos