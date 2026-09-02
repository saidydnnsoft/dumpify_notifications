import { formatDate, getBogotaDateString } from "./utils.js";
import { isBefore, parseISO, isEqual } from "date-fns";

function transformFrentes(frentes) {
  return frentes.reduce((acc, frente) => {
    acc[frente["Row ID"]] = frente;
    return acc;
  }, {});
}

function transformUnidadesDeControl(unidadesDeControl) {
  return unidadesDeControl.reduce((acc, unidadDeControl) => {
    acc[unidadDeControl["Row ID"]] = unidadDeControl;
    return acc;
  }, {});
}

function transformViajes(viajes) {
  return viajes.reduce((acc, viaje) => {
    acc[viaje["Row ID"]] = viaje;
    return acc;
  }, {});
}

function transformMateriales(materiales) {
  return materiales.reduce((acc, material) => {
    acc[material["Row ID"]] = material;
    return acc;
  }, {});
}

function transformCupos(cupos) {
  return cupos.reduce((acc, cupo) => {
    const key = `${cupo["id_material"]}-${cupo["id_unidad_de_control"]}-${cupo["id_frente"]}`;
    const current = acc.get(key) ?? 0;
    acc.set(key, current + Number(cupo["cupo"]));
    return acc;
  }, new Map());
}

function transformUsuariosObras(usuariosObras) {
  return usuariosObras.reduce((acc, usuarioObra) => {
    acc[usuarioObra["Row ID"]] = usuarioObra;
    return acc;
  }, {});
}

function transformObras(obras) {
  return obras.reduce((acc, obra) => {
    acc[obra["Row ID"]] = obra;
    return acc;
  }, {});
}

// saldo_archivo: aporte histórico (pre-migración) YA agregado por (unidad, material).
// Reemplaza la lectura fila-por-fila de viaje_archivo (que se retiró del app).
function transformSaldoArchivo(saldos) {
  const map = new Map(); // unidadId -> Map(materialId -> {m3_externo_origen, m3_interno_origen, m3_interno_destino})
  for (const s of saldos ?? []) {
    const uc = s["id_unidad_de_control"];
    const mat = s["id_material"];
    if (!uc || !mat) continue;
    if (!map.has(uc)) map.set(uc, new Map());
    map.get(uc).set(mat, s);
  }
  return map;
}

export function transform(data) {
  const frentes = transformFrentes(data.frente);
  const unidadesDeControl = transformUnidadesDeControl(data.unidad_de_control);
  const viajes = transformViajes(data.viaje);
  const materiales = transformMateriales(data.material);
  const cupos = transformCupos(data.cupo);
  const usuariosObras = transformUsuariosObras(data.usuario_obra);
  const obras = transformObras(data.obra);
  const saldoArchivo = transformSaldoArchivo(data.saldo_archivo);

  const usuariosMap = new Map();
  for (const usuario of data.usuario) {
    const relatedUsuariosObras =
      usuario["Related usuario_obras"]
        ?.split(",")
        .map((id) => id.trim())
        .filter((id) => id) ?? [];
    const obraIds = relatedUsuariosObras.map(
      (id) => usuariosObras[id]?.id_obra
    );
    usuariosMap.set(usuario["Row ID"], {
      correo: usuario["correo_electronico"],
      rol: usuario["rol"],
      relatedObras: obraIds,
      estado_usuario: usuario["estado_usuario"],
      usuario: usuario["usuario"],
    });
  }

  const rows = [];
  const today = getBogotaDateString();

  for (const obra of data.obra) {
    const frenteIds =
      obra["Related frentes"]
        ?.split(",")
        .map((id) => id.trim())
        .filter((id) => id) ?? [];

    for (const frenteId of frenteIds) {
      const frente = frentes[frenteId];
      const unidadesDeControlId =
        frente["Related unidad_de_controls"]
          ?.split(",")
          .map((id) => id.trim())
          .filter((id) => id) ?? [];

      for (const unidadDeControlId of unidadesDeControlId) {
        const unidadDeControl = unidadesDeControl[unidadDeControlId];

        const materialesMap = new Map();

        const viajesDesdeUnidadDeControl =
          unidadDeControl["Related viajes By id_unidad_de_control_origen"]
            ?.split(",")
            .map((id) => id.trim())
            .filter((id) => id) ?? [];

        for (const viajeId of viajesDesdeUnidadDeControl) {
          const viaje = viajes[viajeId];
          if (viaje["estado"] !== "Anulado") {
            const fechaRecibo = formatDate(viaje["fecha_recibo"]);
            const materialId = viaje["id_material"];
            const tipoViaje = viaje["tipo_viaje"];
            const volumen = Number(viaje["m3_transportados"]);
            const tipoMaterial = materiales[materialId]["tipo"];

            const signo =
              tipoViaje === "Externo" || tipoMaterial === "Corte" ? 1 : -1;
            const volumenFinal = signo * volumen;

            if (!materialesMap.has(materialId)) {
              materialesMap.set(materialId, new Map());
            }
            const unidadMap = materialesMap.get(materialId);

            const actual = unidadMap.get(unidadDeControlId) ?? {
              consumidoAnterior: 0,
              consumidoHoy: 0,
            };

            if (fechaRecibo === today) {
              actual.consumidoHoy += volumenFinal;
            } else if (fechaRecibo < today) {
              actual.consumidoAnterior += volumenFinal;
            }

            unidadMap.set(unidadDeControlId, actual);
          }
        }

        const viajesHaciaUnidadDeControlIds =
          unidadDeControl["Related viajes By id_unidad_de_control_destino"]
            ?.split(",")
            .map((id) => id.trim())
            .filter((id) => id) ?? [];

        for (const viajeId of viajesHaciaUnidadDeControlIds) {
          const viaje = viajes[viajeId];
          if (viaje["estado_viaje"] !== "Anulado") {
            const materialId = viaje["id_material"];
            const fechaRecibo = formatDate(viaje["fecha_recibo"]);
            const tipoViaje = viaje["tipo_viaje"];

            if (tipoViaje === "Interno") {
              const volumen = Number(viaje["m3_transportados"]);
              const tipoMaterial = materiales[materialId]["tipo"];

              const signo = tipoMaterial === "Relleno" ? 1 : -1;
              const volumenFinal = signo * volumen;

              if (!materialesMap.has(materialId)) {
                materialesMap.set(materialId, new Map());
              }
              const unidadMap = materialesMap.get(materialId);

              const actual = unidadMap.get(unidadDeControlId) ?? {
                consumidoAnterior: 0,
                consumidoHoy: 0,
              };

              const fecha = parseISO(fechaRecibo);
              const hoy = parseISO(today);

              if (isEqual(fecha, hoy)) {
                actual.consumidoHoy += volumenFinal;
              } else if (isBefore(fecha, hoy)) {
                actual.consumidoAnterior += volumenFinal;
              }

              unidadMap.set(unidadDeControlId, actual);
            }
          }
        }

        // Aporte histórico (pre-migración) desde saldo_archivo: ya agregado por
        // (unidad, material) y sin anulados. Todo el archivo es viejo → consumidoAnterior.
        // Signos equivalentes a la lógica por-trip:
        //   externo_origen  → +1
        //   interno_origen  → (Corte   ? +1 : -1)
        //   interno_destino → (Relleno ? +1 : -1)
        const saldoUnidad = saldoArchivo.get(unidadDeControlId);
        if (saldoUnidad) {
          for (const [materialId, sums] of saldoUnidad) {
            const tipoMaterial = materiales[materialId]?.["tipo"];
            const aporte =
              Number(sums["m3_externo_origen"] || 0) +
              (tipoMaterial === "Corte" ? 1 : -1) *
                Number(sums["m3_interno_origen"] || 0) +
              (tipoMaterial === "Relleno" ? 1 : -1) *
                Number(sums["m3_interno_destino"] || 0);
            if (aporte === 0) continue;
            if (!materialesMap.has(materialId)) {
              materialesMap.set(materialId, new Map());
            }
            const unidadMap = materialesMap.get(materialId);
            const actual = unidadMap.get(unidadDeControlId) ?? {
              consumidoAnterior: 0,
              consumidoHoy: 0,
            };
            actual.consumidoAnterior += aporte;
            unidadMap.set(unidadDeControlId, actual);
          }
        }

        for (const [materialId, unidadMap] of materialesMap) {
          for (const [
            unidadDeControlId,
            { consumidoAnterior, consumidoHoy },
          ] of unidadMap) {
            const cupo =
              cupos.get(`${materialId}-${unidadDeControlId}-${frenteId}`) ?? 0;
            rows.push({
              obra: obra.nombre,
              idObra: obra["Row ID"],
              estadoUnidadDeControl:
                unidadesDeControl[unidadDeControlId].estado,
              frente: frente.nombre,
              unidadDeControl: unidadesDeControl[unidadDeControlId].nombre,
              material: materiales[materialId].nombre,
              cupo: Number(cupo.toFixed(2)),
              consumidoAnterior: Number(consumidoAnterior.toFixed(2)),
              consumidoHoy: Number(consumidoHoy.toFixed(2)),
              consumidoTotal: Number(
                (consumidoAnterior + consumidoHoy).toFixed(2)
              ),
              disponible: Number(
                (cupo - consumidoAnterior - consumidoHoy).toFixed(2)
              ),
            });
          }
        }
      }
    }
  }

  return {
    rows,
    usuariosMap,
    obras,
  };
}
