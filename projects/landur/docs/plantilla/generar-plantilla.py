"""Genera plantilla-ventas-landur.xlsx: la planilla de ventas pensada para sincronizar con LANDUR.

Es un superconjunto del formato que usa el dueño hoy (mismos encabezados que LANDUR lee) con lo que
hacía fallar la sincronía resuelto de raíz:
  - Fecha REAL obligatoria (no «Setiembre 16», no el día suelto, no vacía).
  - Nro. Pedido obligatorio y único (la mayorista usa M-001, M-002...).
  - Estado, Canal y demás con listas cerradas.
  - Una sola pestaña «Ventas» para minorista y mayorista (Canal = Mayorista).
  - MP Neto y Ganancia Bruta son fórmulas: no se escriben a mano.
Uso: python generar-plantilla.py  (necesita openpyxl)
"""
import datetime
from pathlib import Path
from openpyxl import Workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

# Los nombres de la fila 1 son un contrato con LANDUR: tests/integrations.test.mjs los lee de acá.
HEADERS = ["Fecha","Cliente","Canal","Nro. Pedido","Metodo de pago","Pedido","Unidades","Estado","Bruto","MP Fee","MP Neto","Material","Envío","Metodo de Envío","Pago del envio","Ganancia Bruta"]
LAST = 500  # filas con validación y fórmulas

here = Path(__file__).parent
wb = Workbook()
ws = wb.active
ws.title = "Ventas"
ws.append(HEADERS)

head_fill = PatternFill("solid", fgColor="242253")
calc_fill = PatternFill("solid", fgColor="5B7F73")
for index, cell in enumerate(ws[1], start=1):
    cell.font = Font(bold=True, color="FFFFFF")
    cell.fill = calc_fill if HEADERS[index - 1] in ("MP Neto", "Ganancia Bruta") else head_fill
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
ws.row_dimensions[1].height = 32
ws.freeze_panes = "A2"
for letter, width in zip("ABCDEFGHIJKLMNOP", (12, 26, 12, 13, 15, 30, 10, 12, 11, 10, 11, 11, 10, 15, 14, 14)):
    ws.column_dimensions[letter].width = width

# Ejemplos: las tres ventas reales del «Fragmento contabilidad Landur», ahora con fecha completa.
FIELDS = ("Fecha","Cliente","Canal","Nro. Pedido","Metodo de pago","Pedido","Unidades","Estado","Bruto","MP Fee","Material","Envío","Metodo de Envío","Pago del envio")
examples = [
    (datetime.date(2026, 11, 8), "Esteban Fernandez", "Web", "#1275", "MP", "2 ilumimate1 (Negro)", 2, "Enviado", 970, 101, 80, 190, "Ues", "Cliente"),
    (datetime.date(2026, 11, 9), "Patricia Martinez", "Web", "#1276", "MP", "1 Set Decantador Mundo", 1, "Enviado", 1680, 174, 730, 190, "Ues", "Cliente"),
    (datetime.date(2026, 11, 9), "Mónica Elena Pereira Goicoechea", "Web", "#1277", "MP", "3 ilumimate 2.0 (Verde)", 3, "Enviado", 1730, 180, 120, 260, "Ues", "Cliente"),
]
col = {name: i + 1 for i, name in enumerate(HEADERS)}
for row, data in enumerate(examples, start=2):
    for name, value in zip(FIELDS, data):
        ws.cell(row=row, column=col[name], value=value)

for row in range(2, LAST + 1):
    # Vacío si falta la comisión: «todavía no se cobró». Con MP Fee = 0 (efectivo) el neto es el bruto.
    ws.cell(row=row, column=col["MP Neto"], value=f'=IF(OR(I{row}="",J{row}=""),"",I{row}-J{row})')
    ws.cell(row=row, column=col["Ganancia Bruta"], value=f'=IF(I{row}="","",I{row}-N(J{row})-N(L{row})-N(M{row}))')
    ws.cell(row=row, column=col["Fecha"]).number_format = "dd/mm/yyyy"
    for name in ("Bruto", "MP Fee", "MP Neto", "Material", "Envío", "Ganancia Bruta"):
        ws.cell(row=row, column=col[name]).number_format = "#,##0.##"


def validation(kind, ref, title, message, **kwargs):
    dv = DataValidation(type=kind, allow_blank=True, showErrorMessage=True, errorStyle="stop", errorTitle=title, error=message, **kwargs)
    ws.add_data_validation(dv)
    dv.add(ref)


def rng(letter):
    return f"{letter}2:{letter}{LAST}"


validation("date", rng("A"), "Fecha", "Escribí una fecha completa, por ejemplo 08/11/2026.", operator="greaterThanOrEqual", formula1="43831")
validation("list", rng("C"), "Canal", "Elegí un canal de la lista.", formula1='"Web,Instagram,WhatsApp,Mayorista,Local"')
validation("custom", rng("D"), "Nro. Pedido", "El número de pedido es obligatorio y no puede repetirse (mayorista: M-001, M-002...).", formula1=f"AND(LEN(D2)>0,COUNTIF($D$2:$D${LAST},D2)=1)")
validation("list", rng("E"), "Método de pago", "Elegí un método de la lista.", formula1='"MP,Efectivo,Transferencia"')
validation("whole", rng("G"), "Unidades", "Las unidades son un número entero de 1 o más.", operator="greaterThanOrEqual", formula1="1")
validation("list", rng("H"), "Estado", "Elegí un estado de la lista.", formula1='"Pendiente,Enviado,Entregado,Cancelado"')
validation("decimal", rng("I"), "Bruto", "El bruto es un importe mayor que cero.", operator="greaterThan", formula1="0")
for letter in "JLM":
    validation("decimal", rng(letter), "Importe", "Escribí un importe de cero o más (sin símbolos).", operator="greaterThanOrEqual", formula1="0")
validation("list", rng("O"), "Pago del envío", "Elegí Cliente, Landur o Nadie.", formula1='"Cliente,Landur,Nadie"')

ws.conditional_formatting.add(f"D2:D{LAST}", FormulaRule(formula=[f'AND(D2<>"",COUNTIF($D$2:$D${LAST},D2)>1)'], fill=PatternFill("solid", bgColor="F4B6B0")))
ws.conditional_formatting.add(f"A2:P{LAST}", FormulaRule(formula=['$H2="Cancelado"'], font=Font(color="999999", strike=True)))
ws.auto_filter.ref = f"A1:P{LAST}"

# ---- Instrucciones -------------------------------------------------------------------------------
guide = wb.create_sheet("Instrucciones")
guide.column_dimensions["A"].width = 120
rules = [
    ("CÓMO SE USA ESTA PLANILLA", "title"),
    ("Una fila = una venta. Minorista y mayorista van en la misma pestaña «Ventas» (columna Canal).", ""),
    ("No cambies los nombres de la fila 1: LANDUR los lee. Podés agregar columnas propias a la derecha (Reinversión, Rafa, Luis...): LANDUR las ignora.", ""),
    ("Las columnas verdes (MP Neto, Ganancia Bruta) son fórmulas: no se escriben.", ""),
    ("", ""),
    ("REGLAS", "title"),
    ("Fecha: siempre la fecha completa (08/11/2026). Nunca «Setiembre 16», nunca solo el día, nunca vacía.", ""),
    ("Nro. Pedido: obligatorio y único. Minorista: el de la tienda (#1275). Mayorista: M-001, M-002... La planilla marca en rojo un repetido.", ""),
    ("Estado: Pendiente, Enviado, Entregado o Cancelado. Al pasar un pedido a Cancelado, LANDUR revierte la venta, el cobro y los gastos.", ""),
    ("Bruto: lo que paga el cliente (incluye el envío si se lo cobrás).", ""),
    ("MP Fee: vacío = todavía no se cobró (LANDUR registra la venta pero no el cobro). 0 = cobrado sin comisión (efectivo, transferencia). Un número = la comisión de Mercado Pago.", ""),
    ("Material y Envío: los costos de esa venta. LANDUR los registra como gasto de la cuenta elegida (categorías Materiales y Envíos).", ""),
    ("Ganancia Bruta = Bruto - MP Fee - Material - Envío. Es lo que suma el saldo de la cuenta en LANDUR (más el saldo inicial).", ""),
    ("", ""),
    ("EDITAR Y BORRAR ES SEGURO", "title"),
    ("Si corregís un importe, una fecha o la comisión, o borrás una fila, LANDUR revierte lo anterior y registra lo nuevo. Queda en el historial; nada se pierde.", ""),
    ("Si ya hay un cobro cargado a mano en LANDUR para esa venta, LANDUR no lo toca y avisa.", ""),
    ("", ""),
    ("EN LANDUR (Conexiones → Google Sheets)", "title"),
    ("Pestaña: Ventas · Mes de la planilla: dejar vacío · Cuenta: la cuenta donde entra la plata · Estados que cuentan como cobrado: vacío · Costo de material: Material.", ""),
    ("Compartí esta planilla (permiso de lector) con el correo de la cuenta de servicio de Google (termina en .iam.gserviceaccount.com).", ""),
    ("El saldo inicial (corte) de la cuenta en LANDUR tiene que ser anterior a la fecha de la venta más vieja de la planilla.", ""),
    ("", ""),
    ("SINCRONIZACIÓN AUTOMÁTICA (tiempo real)", "title"),
    ("Extensiones → Apps Script → pegá el código de abajo → ejecutá configurar() y después instalar() (una vez cada una).", ""),
    ("A partir de ahí cada edición avisa a LANDUR y hay un latido cada 5 minutos. En el servidor tiene que existir la variable LANDUR_SYNC_TOKEN (32 caracteres o más).", ""),
    ("", ""),
    ("CÓDIGO DE APPS SCRIPT", "title"),
]
for text, kind in rules:
    guide.append([text])
    cell = guide.cell(row=guide.max_row, column=1)
    cell.alignment = Alignment(wrap_text=True, vertical="top")
    if kind == "title":
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = head_fill
for line in (here / "apps-script.gs").read_text(encoding="utf-8").splitlines():
    guide.append([line])
    guide.cell(row=guide.max_row, column=1).font = Font(name="Consolas", size=10)

out = here / "plantilla-ventas-landur.xlsx"
wb.save(out)
print("OK", out)
