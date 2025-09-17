import { fileURLToPath } from "url";
import fs from "fs";
import handlebars from "handlebars";
import { getBogotaDateString } from "./utils.js";

export function renderTemplate(data) {
  const fileUrl = new URL("./plantilla-resumen-consumos.hbs", import.meta.url);
  const filePath = fileURLToPath(fileUrl);
  const templateString = fs.readFileSync(filePath, "utf-8");
  const compiled = handlebars.compile(templateString);
  return compiled(data);
}

export async function sendResumenEmail(to, name, attachments, transporter) {
  const html = renderTemplate({
    name,
    date: getBogotaDateString("dd/MM/yyyy"),
  });

  await transporter.sendMail({
    from: `"${process.env.EMAIL_NAME}" <${process.env.EMAIL_FROM}>`,
    to,
    subject: "Resumen de consumo de materiales",
    html,
    attachments,
  });
}
