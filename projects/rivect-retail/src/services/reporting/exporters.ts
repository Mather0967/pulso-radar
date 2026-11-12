import type { InventoryReport, RecoveryLead, ReportModel, Product } from '@/domain/models'
import { money, num, pct } from '@/utils/format'
import { RECOVERY_STATUS_META } from '@/domain/calculations/recovery'

const CSV_SEPARATOR = ';'

const escapeCell = (value: string | number): string => {
  const text = String(value ?? '').replace(/"/g, '""')
  return `"${text}"`
}

export function downloadCsv(filename: string, rows: Record<string, string | number>[]): void {
  if (rows.length === 0) return
  const headers = Object.keys(rows[0])
  const lines = [
    headers.map(escapeCell).join(CSV_SEPARATOR),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(CSV_SEPARATOR)),
  ]
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function inventoryCsvRows(report: InventoryReport) {
  return report.items.map((item) => ({
    SKU: item.product.sku,
    Producto: item.product.name,
    Categoria: item.product.category,
    Precio: item.product.price,
    Costo: item.product.cost,
    Stock: item.product.stock,
    'Unidades vendidas mes': item.product.monthlyUnitsSold,
    'Cobertura (dias)': item.coverageDays === null ? 'sin ventas' : Number(item.coverageDays.toFixed(1)),
    'Capital inmovilizado': Math.round(item.inventoryCapital),
    'Dias sin venta': item.daysSinceLastSale,
    Alertas: item.alerts.map((a) => a.title).join(' | '),
  }))
}

export function leadsCsvRows(leads: RecoveryLead[], products: Product[]) {
  return leads.map((lead) => ({
    Cliente: lead.customerName,
    Canal: lead.channel,
    Producto: products.find((p) => p.id === lead.productId)?.name ?? lead.productId,
    Estado: RECOVERY_STATUS_META[lead.status].label,
    'Ticket estimado': lead.estimatedTicket,
    'Probabilidad (%)': lead.estimatedConversion,
    'Ultimo contacto': lead.lastContact,
    'Accion sugerida': lead.suggestedAction,
  }))
}

/** Genera un PDF de marca con el informe completo (sin backend). */
export async function downloadReportPdf(report: ReportModel): Promise<void> {
  // Carga diferida: jsPDF solo se descarga al exportar el informe.
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 48
  const contentWidth = pageWidth - margin * 2
  let y = 0

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage()
      y = margin
    }
  }

  // Cabecera
  doc.setFillColor(7, 11, 20)
  doc.rect(0, 0, pageWidth, 132, 'F')
  doc.setTextColor(91, 149, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('RIVECT · RETAIL INTELLIGENCE', margin, 46)
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.text('Informe de oportunidades', margin, 76)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(190, 205, 235)
  doc.text(`${report.storeName} · ${report.businessType}`, margin, 96)
  doc.text(`Generado el ${new Date(report.generatedAt).toLocaleString('es-AR')}`, margin, 112)
  doc.setTextColor(247, 189, 84)
  doc.text('DOCUMENTO DE DEMOSTRACIÓN · DATOS SIMULADOS', margin, 126)

  y = 168
  for (const section of report.sections) {
    ensureSpace(96)
    doc.setTextColor(18, 46, 110)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.text(section.title, margin, y)
    y += 16

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(90, 100, 120)
    const summaryLines = doc.splitTextToSize(section.summary, contentWidth) as string[]
    doc.text(summaryLines, margin, y)
    y += summaryLines.length * 12 + 6

    doc.setFontSize(9.5)
    for (const metric of section.metrics) {
      ensureSpace(16)
      doc.setTextColor(110, 120, 140)
      doc.text(metric.label, margin, y)
      doc.setTextColor(20, 26, 40)
      doc.setFont('helvetica', 'bold')
      const value = metric.value
      doc.text(doc.splitTextToSize(value, 200) as string[], margin + 220, y)
      doc.setFont('helvetica', 'normal')
      y += 14
    }

    y += 4
    doc.setTextColor(70, 80, 100)
    for (const bullet of section.bullets) {
      ensureSpace(16)
      const lines = doc.splitTextToSize(`•  ${bullet}`, contentWidth - 10) as string[]
      doc.text(lines, margin, y)
      y += lines.length * 12
    }
    y += 18
    doc.setDrawColor(225, 230, 240)
    doc.line(margin, y - 8, pageWidth - margin, y - 8)
  }

  ensureSpace(60)
  doc.setFontSize(8)
  doc.setTextColor(130, 140, 160)
  doc.text(
    'Las cifras son estimaciones basadas en los datos ingresados y en supuestos editables.',
    margin,
    pageHeight - 46,
  )
  doc.text('Rivect Retail Intelligence · demostración comercial', margin, pageHeight - 34)

  doc.save(`rivect-informe-${new Date().toISOString().slice(0, 10)}.pdf`)
}

export function reportCsvRows(report: ReportModel) {
  return report.sections.flatMap((section) =>
    section.metrics.map((metric) => ({
      Seccion: section.title,
      Indicador: metric.label,
      Valor: metric.value,
      Nota: metric.hint ?? '',
    })),
  )
}

export const summaryLine = (report: ReportModel): string =>
  `${report.storeName}: ${money(report.simulator.additionalContribution)} de margen adicional estimado · ${num(
    report.simulator.recoverableHours,
    1,
  )} h recuperables · ${pct(report.simulator.upliftPct, 1)} de mejora`
