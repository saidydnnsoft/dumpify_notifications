import axios from "axios";

async function extractOne(tableName, appSheetConfig) {
  const { appKey, appId, appsheetRegion } = appSheetConfig;
  const url = `https://${appsheetRegion}/api/v2/apps/${appId}/tables/${tableName}/Action`;
  const payload = { Action: "Find" };

  try {
    const { data } = await axios.post(url, payload, {
      headers: {
        ApplicationAccessKey: appKey,
        "Content-Type": "application/json",
      },
    });
    return data;
  } catch (err) {
    console.error(
      `❌ Error extracting from ${tableName}:`,
      err.response?.data || err.message
    );
    return [];
  }
}

export async function extract() {
  const appSheetConfig = {
    appKey: process.env.APP_KEY,
    appId: process.env.APP_ID,
    appsheetRegion: "www.appsheet.com",
  };

  const tableNames = [
    "usuario",
    "obra",
    "usuario_obra",
    "frente",
    "unidad_de_control",
    "material",
    "cupo",
    "viaje",
    // Antes se leía "viaje_archivo" (histórico completo). Ahora esa tabla se retiró del app;
    // el aporte histórico viene pre-agregado (por unidad×material) en "saldo_archivo".
    "saldo_archivo",
  ];

  const data = await Promise.all(
    tableNames.map((name) => extractOne(name, appSheetConfig))
  );

  const tables = {};
  tableNames.forEach((name, i) => {
    tables[name] = data[i];
  });

  return tables;
}
