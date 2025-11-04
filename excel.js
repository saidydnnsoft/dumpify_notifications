import ExcelJS from "exceljs";

export async function exportToExcelBuffer(data) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Resumen");

  sheet.columns = [
    { header: "Obra", key: "obra", width: 25 },
    { header: "Frente", key: "frente", width: 25 },
    { header: "Unidad de Control", key: "unidadDeControl", width: 25 },
    {
      header: "Estado Unidad de Control",
      key: "estadoUnidadDeControl",
      width: 25,
    },
    { header: "Material", key: "material", width: 30 },
    { header: "Cupo", key: "cupo", width: 12, style: { numFmt: "#,##0.00" } },
    {
      header: "Consumido anterior",
      key: "consumidoAnterior",
      width: 18,
      style: { numFmt: "#,##0.00" },
    },
    {
      header: "Consumido hoy",
      key: "consumidoHoy",
      width: 15,
      style: { numFmt: "#,##0.00" },
    },
    {
      header: "Consumido total",
      key: "consumidoTotal",
      width: 15,
      style: { numFmt: "#,##0.00" },
    },
    {
      header: "Saldo",
      key: "disponible",
      width: 12,
      style: { numFmt: "#,##0.00" },
    },
  ];

  sheet.addRows(
    data.map((row) => ({
      obra: row.obra,
      frente: row.frente,
      unidadDeControl: row.unidadDeControl,
      estadoUnidadDeControl: row.estadoUnidadDeControl,
      material: row.material,
      cupo: row.cupo,
      consumidoAnterior: row.consumidoAnterior,
      consumidoHoy: row.consumidoHoy,
      consumidoTotal: row.consumidoTotal,
      disponible: row.disponible,
    }))
  );

  sheet.addTable({
    name: "ResumenConsumo",
    ref: "A1",
    headerRow: true,
    style: {
      theme: "TableStyleMedium9",
      showRowStripes: true,
    },
    columns: sheet.columns.map((col) => ({
      name: col.header,
      filterButton: true,
    })),
    rows: data.map((row) => [
      row.obra,
      row.frente,
      row.unidadDeControl,
      row.material,
      row.cupo,
      row.consumidoAnterior,
      row.consumidoHoy,
      row.consumidoTotal,
      row.disponible,
    ]),
  });

  const startRow = 2;
  data.forEach((row, i) => {
    const cell = sheet.getCell(`I${i + startRow}`);
    cell.numFmt = "#,##0.00";
    if (cell.value < 0) {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFC7CE" },
      };
      cell.font = { color: { argb: "9C0006" } };
    }
  });

  return workbook.xlsx.writeBuffer();
}
