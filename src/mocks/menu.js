export const categorias = [
  { id: 1, nombre: 'Entradas',    emoji: '🥗' },
  { id: 2, nombre: 'Sopas',       emoji: '🍲' },
  { id: 3, nombre: 'Principales', emoji: '🍽️' },
  { id: 4, nombre: 'Bebidas',     emoji: '🥤' },
  { id: 5, nombre: 'Postres',     emoji: '🍮' },
]

export const productos = [
  // Entradas
  { id: 1, categoriaId: 1, nombre: 'Anticuchos',        descripcion: 'Brochetas de corazón de res a la parrilla con llajua',              precio: 25, disponible: true },
  { id: 2, categoriaId: 1, nombre: 'Salteña',           descripcion: 'Empanada horneada rellena de carne jugosa y verduras',              precio: 8,  disponible: true },
  { id: 3, categoriaId: 1, nombre: 'Tucumana',          descripcion: 'Empanada frita con pollo, papa y huevo',                           precio: 8,  disponible: true },
  // Sopas
  { id: 4, categoriaId: 2, nombre: 'Sopa de Maní',      descripcion: 'Sopa cremosa de maní con papa, fideos y verduras',                 precio: 20, disponible: true },
  { id: 5, categoriaId: 2, nombre: 'Chairo',            descripcion: 'Sopa tradicional con chuño, charque y verduras',                   precio: 22, disponible: true },
  { id: 6, categoriaId: 2, nombre: 'Sopa de Maíz',      descripcion: 'Con trozos de maíz tierno, papa y carne',                         precio: 18, disponible: true },
  // Principales
  { id: 7,  categoriaId: 3, nombre: 'Pique Macho',       descripcion: 'Carne picada, salchicha, papa frita, tomate y locoto',             precio: 55, disponible: true },
  { id: 8,  categoriaId: 3, nombre: 'Silpancho',         descripcion: 'Carne apanada sobre arroz y papa, cubierta de huevo y ensalada',  precio: 40, disponible: true },
  { id: 9,  categoriaId: 3, nombre: 'Charque Cochabambino', descripcion: 'Charque de llama con mote, queso frito y locoto',             precio: 45, disponible: true },
  { id: 10, categoriaId: 3, nombre: 'Majadito',          descripcion: 'Arroz con charque, plátano frito y huevo',                        precio: 35, disponible: true },
  { id: 11, categoriaId: 3, nombre: 'Chicharrón de Cerdo', descripcion: 'Cerdo frito crocante con mote y llajua',                       precio: 50, disponible: true },
  // Bebidas
  { id: 12, categoriaId: 4, nombre: 'Api con Pastel',    descripcion: 'Bebida caliente de maíz morado con buñuelo',                     precio: 12, disponible: true },
  { id: 13, categoriaId: 4, nombre: 'Cerveza Nacional',  descripcion: 'Botella 600ml bien fría',                                        precio: 15, disponible: true },
  { id: 14, categoriaId: 4, nombre: 'Jugo Natural',      descripcion: 'Mango, maracuyá o naranja del día',                              precio: 12, disponible: true },
  { id: 15, categoriaId: 4, nombre: 'Refresco',          descripcion: 'Coca-Cola, Pepsi o 7Up',                                         precio: 8,  disponible: true },
  { id: 16, categoriaId: 4, nombre: 'Agua Mineral',      descripcion: 'Botella 600ml',                                                  precio: 5,  disponible: true },
  // Postres
  { id: 17, categoriaId: 5, nombre: 'Arroz con Leche',   descripcion: 'Cremoso, con canela y pasas',                                    precio: 12, disponible: true },
  { id: 18, categoriaId: 5, nombre: 'Helado Artesanal',  descripcion: 'Tres sabores a elegir',                                          precio: 15, disponible: true },
]