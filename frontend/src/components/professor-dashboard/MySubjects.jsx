import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import axios from "axios";

const MySubjects = () => {
  const [materias, setMaterias] = useState([]);
  // Aquí guardarás lo que traigas del back
  const [materiaActual, setMateriaActual] = useState({
    nombre_materia: "",
    codigo_materia: "",
    cod_carrera: "INFORMATICA", // Por defecto
    cod_semestre: "",
    cupos_maximos: 30,
  });

  const [bloqueActual, setBloqueActual] = useState({
    dias_semana: "",
    hora_inicio: "",
    hora_fin: "",
    seccion_grupo: "",
    aula: "",
  });

  const [idDesplegado, setIdDesplegado] = useState(null);

  const getAuthConfig = () => {
    const tokenJSON = window.localStorage.getItem("loggedAppUser");
    if (!tokenJSON) return null;
    return {
      headers: { Authorization: `Bearer ${JSON.parse(tokenJSON).token}` },
    };
  };

  // Traer las materias del profesor al cargar el componente
  useEffect(() => {
    getMaterias();
  }, []);

  // --- LÓGICA DE DETECCIÓN DE CHOQUE ---
  const verificarChoque = (nuevoBloque) => {
    return materias.some((m) =>
      m.horario.some((h) => {
        // 1. Validar que sea el mismo día
        if (h.dias_semana !== nuevoBloque.dias_semana) return false;

        // 2. Aplicar la lógica de rangos (Magia Técnica [2])
        // Hay choque si el nuevo inicio es antes del fin existente
        // Y el nuevo fin es después del inicio existente.
        const haySolapamiento =
          nuevoBloque.hora_inicio < h.hora_fin &&
          nuevoBloque.hora_fin > h.hora_inicio;

        return haySolapamiento;
      }),
    );
  };

  // Crear la materia en el estado (Contenedor)
  const handleCrearMateria = async (e) => {
    e.preventDefault();
    const nueva = { ...materiaActual, id_temp: Date.now(), horario: [] };
    try {
      const config = getAuthConfig();
      if (!config) {
        Swal.fire("Error de Sesión", "No se encontró una sesión activa.", "error");
        return;
      }
      const respuesta = await axios.post("/api/materias", nueva, config);
      if (respuesta.status === 201) {
        Swal.fire(
          "¡Materia Creada!",
          "La materia se ha creado exitosamente en el servidor.",
          "success",
        );
        setMateriaActual({
          nombre_materia: "",
          codigo_materia: "",
          cod_carrera: "INFORMATICA",
          cod_semestre: "",
          cupos_maximos: 30,
        });
        await getMaterias();
      }
    } catch (error) {
      Swal.fire("Error", "No se pudo crear la materia. Intenta de nuevo.");
    }
  };

  const getMaterias = async () => {
    try {
      const config = getAuthConfig();
      if (!config) {
        setMaterias([]);
        return;
      }
      const respuesta = await axios.get("/api/materias", config);
      setMaterias(respuesta.data);
    } catch (error) {
      Swal.fire(
        "Error",
        "No se pudieron obtener las materias. Intenta de nuevo.",
        "error",
      );
    }
  };
  // Añadir un bloque de horario a una materia específica
  const añadirHorario = async (idMateria) => {
    // Función auxiliar para forzar formato HH:mm (24h)
    const limpiarHora = (hora) => {
      // Si viene con am/pm, esto lo detecta y podrías convertirlo,
      return hora.split(" "); // Quita cualquier "am" o "pm" si existiera
    };

    const bloqueLimpio = {
      ...bloqueActual,
      hora_inicio: limpiarHora(bloqueActual.hora_inicio),
      hora_fin: limpiarHora(bloqueActual.hora_fin),
    };

    if (verificarChoque(bloqueLimpio)) {
      Swal.fire("Choque detectado", "Este horario ya está ocupado", "warning");
      return;
    }

    // 1. VALIDACIÓN ESTRICTA (No permitir strings vacíos o nulos)
    if (
      !bloqueActual.dias_semana.trim() ||
      !bloqueActual.hora_inicio ||
      !bloqueActual.hora_fin ||
      !bloqueActual.seccion_grupo.trim() ||
      !bloqueActual.aula.trim()
    ) {
      Swal.fire(
        "Error",
        "Todos los campos del bloque son obligatorios",
        "error",
      );
      return; // Detiene la ejecución aquí
    }

    try {
      const tokenJSON = window.localStorage.getItem("loggedAppUser");
      if (!tokenJSON) {
        Swal.fire(
          "Error de Sesión",
          "No se encontró una sesión activa. Por favor, reingresa.",
          "error",
        );
        return;
      }

      const user = JSON.parse(tokenJSON);

      const config = {
        headers: { Authorization: `Bearer ${JSON.parse(tokenJSON).token}` },
      };

      // ENVIAR AL BACKEND: Esto es lo que hace que el estudiante lo vea
      await axios.put(
        `/api/materias/${idMateria}/horario`,
        bloqueActual,
        config,
      );

      // Actualizar vista local
      setMaterias(
        materias.map((m) => {
          const idActual = m._id || m.id_temp;
          if (idActual === idMateria) {
            return { ...m, horario: [...m.horario, { ...bloqueActual }] };
          }
          return m;
        }),
      );

      setBloqueActual({
        dias_semana: "",
        hora_inicio: "",
        hora_fin: "",
        seccion_grupo: "",
        aula: "",
      });
    } catch (error) {
      console.error("Error al guardar el horario:", error);
      Swal.fire(
        "Error",
        "No se pudo guardar el horario en el servidor",
        "error",
      );
    }
  };

  // --- FUNCIÓN PARA ELIMINAR MATERIA COMPLETA (El botón de la basurita) ---
  const eliminarMateria = async (idMateria) => {
    const resultado = await Swal.fire({
      title: "¿Eliminar materia?",
      text: "Se borrarán todos los horarios asociados permanentemente.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      confirmButtonText: "Sí, eliminar",
    });

    if (resultado.isConfirmed) {
      try {
        // Petición al backend usando el ID real
        await axios.delete(`/api/materias/${idMateria}`);
        // Filtramos localmente para actualizar la vista sin recargar
        setMaterias(materias.filter((m) => (m._id || m.id_temp) !== idMateria));
        Swal.fire("Eliminada", "La materia ha sido borrada.", "success");
      } catch (error) {
        Swal.fire("Error", "No se pudo eliminar de la base de datos.", "error");
      }
    }
  };

  // --- FUNCIÓN PARA ELIMINAR UN DÍA/HORA ESPECÍFICO ---
  const eliminarHorario = async (idMateria, index) => {
    try {
      // Llamada al backend para persistir el cambio en MongoDB
      await axios.delete(`/api/materias/${idMateria}/horario/${index}`);

      // Actualización inmutable del estado
      setMaterias(
        materias.map((m) => {
          const idActual = m._id || m.id_temp;
          if (idActual === idMateria) {
            return { ...m, horario: m.horario.filter((_, i) => i !== index) };
          }
          return m;
        }),
      );
    } catch (error) {
      Swal.fire("Error", "No se pudo eliminar el horario de la BD.", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* FORMULARIO PARA CREAR MATERIA */}
      <div className="bg-white p-6 rounded-2xl shadow-xl border-t-8 border-indigo-900">
        <h3 className="font-bold text-gray-800 mb-4">
          Registrar Nueva Materia
        </h3>
        <form
          onSubmit={handleCrearMateria}
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <input
            className="p-3 border rounded-xl bg-gray-50"
            placeholder="Nombre (Ej: Redes)"
            value={materiaActual.nombre_materia}
            onChange={(e) =>
              setMateriaActual({
                ...materiaActual,
                nombre_materia: e.target.value,
              })
            }
            required
          />
          <input
            className="p-3 border rounded-xl bg-gray-50"
            placeholder="Código (Ej: INF-101)"
            value={materiaActual.codigo_materia}
            onChange={(e) =>
              setMateriaActual({
                ...materiaActual,
                codigo_materia: e.target.value,
              })
            }
            required
          />
          <input
            className="p-3 border rounded-xl bg-gray-50"
            placeholder="Semestre (Ej: Trayecto I)"
            value={materiaActual.cod_semestre}
            onChange={(e) =>
              setMateriaActual({
                ...materiaActual,
                cod_semestre: e.target.value,
              })
            }
            required
          />
          <button
            type="submit"
            className="bg-indigo-900 text-white font-bold rounded-xl hover:bg-black transition-all"
          >
            CREAR MATERIA
          </button>
        </form>
      </div>

      {/* LISTADO DE MATERIAS CON DESPLEGABLE */}
      <div className="space-y-4">
        {materias.length === 0 && (
          <div className="bg-white p-5 rounded-xl border border-dashed border-gray-300 text-gray-600">
            Aún no tienes materias registradas. Crea una materia para comenzar.
          </div>
        )}

        {materias.map((m) => {
          // Definimos la variable idActual para que el sistema reconozca
          // el ID de la base de datos o el temporal [History]
          const idActual = m._id || m.id_temp;

          return (
            <div
              key={idActual}
              className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden"
            >
              <div className="p-5 flex justify-between items-center">
                <div
                  className="flex-1 cursor-pointer hover:bg-gray-50"
                  onClick={() =>
                    setIdDesplegado(idDesplegado === idActual ? null : idActual)
                  }
                >
                  <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold mr-3">
                    {m.codigo_materia}
                  </span>
                  <span className="font-bold text-xl text-gray-800">
                    {m.nombre_materia}
                  </span>
                </div>

                {/* BOTÓN DE LA BASURITA (Eliminar Materia Completa) */}
                <button
                  onClick={() => eliminarMateria(idActual)}
                  className="text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors mr-4"
                >
                  🗑️
                </button>

                <span className="text-2xl">
                  {idDesplegado === idActual ? "▲" : "▼"}
                </span>
              </div>

              {/* CONTENIDO DESPLEGABLE: Ahora se mostrará porque usamos idActual */}
              {idDesplegado === idActual && (
                <div className="p-6 border-t border-gray-100 bg-gray-50/30">
                  {/* Formulario de Bloque (Inputs para elegir el horario) */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                    <select
                      className="p-2 border rounded-lg bg-white"
                      value={bloqueActual.dias_semana}
                      onChange={(e) =>
                        setBloqueActual({
                          ...bloqueActual,
                          dias_semana: e.target.value,
                        })
                      }
                    >
                      <option value="">Día...</option>
                      {[
                        "Lunes",
                        "Martes",
                        "Miércoles",
                        "Jueves",
                        "Viernes",
                        "Sábado",
                      ].map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                    <input
                      type="time"
                      className="p-2 border rounded-lg"
                      value={bloqueActual.hora_inicio}
                      onChange={(e) =>
                        setBloqueActual({
                          ...bloqueActual,
                          hora_inicio: e.target.value,
                        })
                      }
                    />
                    <input
                      type="time"
                      className="p-2 border rounded-lg"
                      value={bloqueActual.hora_fin}
                      onChange={(e) =>
                        setBloqueActual({
                          ...bloqueActual,
                          hora_fin: e.target.value,
                        })
                      }
                    />
                    <input
                      placeholder="Sección"
                      className="p-2 border rounded-lg"
                      value={bloqueActual.seccion_grupo}
                      onChange={(e) =>
                        setBloqueActual({
                          ...bloqueActual,
                          seccion_grupo: e.target.value,
                        })
                      }
                    />
                    <input
                      placeholder="Aula"
                      className="p-2 border rounded-lg"
                      value={bloqueActual.aula}
                      onChange={(e) =>
                        setBloqueActual({
                          ...bloqueActual,
                          aula: e.target.value,
                        })
                      }
                    />

                    <button
                      onClick={() => añadirHorario(idActual)}
                      className="bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
                    >
                      Añadir Bloque
                    </button>
                  </div>

                  {/* Tabla de Horarios guardados */}
                  <div className="space-y-3">
                    {m.horario.map((h, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-indigo-50"
                      >
                        <div className="flex gap-8 items-center">
                          <span className="font-black text-indigo-900">
                            {h.dias_semana}
                          </span>
                          <span className="text-gray-600">
                            {h.hora_inicio} - {h.hora_fin}
                          </span>
                          <span className="bg-gray-100 px-3 py-1 rounded-lg text-xs font-bold text-gray-500">
                            Sección: {h.seccion_grupo}
                          </span>
                          <span className="bg-gray-100 px-3 py-1 rounded-lg text-xs font-bold text-gray-500">
                            Aula: {h.aula}
                          </span>
                        </div>
                        <button
                          onClick={() => eliminarHorario(idActual, index)}
                          className="text-red-400 hover:text-red-600 font-bold"
                        >
                          ELIMINAR
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MySubjects;
