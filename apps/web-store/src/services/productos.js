import { API_Jesus } from "./api";


export async function consultarProducto(id) {
  const res = await fetch(`${API_Jesus}/Productos/Consultar?Id=${id}`, {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);

  return await res.json();
}


export async function listarProductos(indice = 0) {
  const res = await fetch(`${API_Jesus}/Productos/Listar?indice=${indice}`, {
    method: "GET",
    headers: { Accept: "application/json" }
  });

  if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
  return await res.json();
}


export function urlImagenProducto(id) {
  return `${API_Jesus}/Productos/Imagen?id=${id}`;
}


export async function guardarProducto(producto, archivoImagen = null) {
  const formData = new FormData();


  formData.append("Id",            producto.id ?? 0);
  formData.append("Codigo",        producto.codigo ?? "");
  formData.append("Nombre",        producto.nombre ?? "");
  formData.append("Descripcion",   producto.descripcion ?? "");
  formData.append("Categoriaint",  producto.categoriaint ?? 0);
  formData.append("Proveedorint",  producto.proveedorint ?? 0);
  formData.append("Stock",         producto.stock ?? 0);
  formData.append("PrecioCompra",  producto.precioCompra ?? 0);
  formData.append("PrecioVenta",   producto.precioVenta ?? 0);
  formData.append("UnidadMedida",  producto.unidadMedida ?? "");
  formData.append("Estado",        producto.estado ?? true);

  if (archivoImagen) {
    formData.append("Archivo", archivoImagen);
  }

  const res = await fetch(`${API_Jesus}/Productos/Guardar`, {
    method: "POST",
    body: formData               // ⚠️ NO pongas Content-Type, el navegador lo pone solo
  });

  if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
  return await res.json();       // { id: 5 }
}


export async function actualizarProducto(producto, archivoImagen = null) {
  if (!producto.id || producto.id <= 0) {
    throw new Error("Se requiere un Id válido para actualizar");
  }

  const formData = new FormData();
  formData.append("Id",            producto.id);
  formData.append("Codigo",        producto.codigo ?? "");
  formData.append("Nombre",        producto.nombre ?? "");
  formData.append("Descripcion",   producto.descripcion ?? "");
  formData.append("Categoriaint",  producto.categoriaint ?? 0);
  formData.append("Proveedorint",  producto.proveedorint ?? 0);
  formData.append("Stock",         producto.stock ?? 0);
  formData.append("PrecioCompra",  producto.precioCompra ?? 0);
  formData.append("PrecioVenta",   producto.precioVenta ?? 0);
  formData.append("UnidadMedida",  producto.unidadMedida ?? "");
  formData.append("Estado",        producto.estado ?? true);

  if (archivoImagen) {
    formData.append("Archivo", archivoImagen);
  }

  const res = await fetch(`${API_Jesus}/Productos/Actualizar`, {
    method: "PUT",
    body: formData
  });

  if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
  return await res.json();
}

// ==========================================================
// DELETE /Productos/Eliminar?Id=1
// ==========================================================
export async function eliminarProducto(id) {
  const res = await fetch(`${API_Jesus}/Productos/Eliminar?Id=${id}`, {
    method: "DELETE"
  });

  if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
  return true;
}