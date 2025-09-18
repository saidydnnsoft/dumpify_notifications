import { extract } from "./extract.js";
import dotenv from "dotenv";
import fs from "fs";

if (fs.existsSync(".env")) {
  dotenv.config();
}
import { transform } from "./transform.js";
import { exportToExcelBuffer } from "./excel.js";
import { sendResumenEmail } from "./email.js";
import { getBogotaDateString } from "./utils.js";
import { http } from "@google-cloud/functions-framework";
import nodemailer from "nodemailer";

// --- Main HTTP Function ---
http("sendNotifications", async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }
  try {
    const today = getBogotaDateString("dd-MM-yyyy");
    console.log("Extracting data...");
    const rawData = await extract();

    console.log("Transforming data...");
    const { rows, usuariosMap, obras } = transform(rawData);

    console.log("Exporting data...");
    const obrasMap = new Map();
    for (const row of rows) {
      const obraId = row.idObra;
      if (!obrasMap.has(obraId)) obrasMap.set(obraId, []);
      obrasMap.get(obraId).push(row);
    }

    const obraBuffers = new Map();
    for (const [obraId, obraRows] of obrasMap) {
      const buffer = await exportToExcelBuffer(obraRows);
      obraBuffers.set(obraId, buffer);
    }

    console.log("Sending emails...");
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
    for (const [_, usuario] of usuariosMap) {
      if (usuario.estado_usuario === "ACTIVO") {
        const attachments = [];

        for (const obraId of usuario.relatedObras) {
          const obra = obras[obraId];
          if (!obra) continue;
          const buffer = obraBuffers.get(obraId);
          if (!buffer) continue;

          attachments.push({
            filename: `resumen_${obra.nombre.replace(
              /\s+/g,
              "_"
            )}_${today}.xlsx`,
            content: buffer,
            contentType:
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
        }

        if (
          attachments.length > 0 &&
          ["Admin", "Super admin", "Auditor"].includes(usuario.rol)
          // && usuario.correo === "saidnader1987@hotmail.com"
        ) {
          await sendResumenEmail(
            usuario.correo,
            usuario.usuario,
            attachments,
            transporter
          );
        }
      }
    }
    res.send("✅ Job complete!");
  } catch (error) {
    console.error("❌ Send notifications failed: ", error.message);
    if (error.stack) console.error(error.stack);
    if (error.errors) {
      error.errors.forEach((err) =>
        console.error(
          `Error: ${err.message}, Reason: ${err.reason}, Location: ${err.location}`
        )
      );
    }
    res.status(500).send(`Send notifications failed: ${error.message}`);
  }
});
