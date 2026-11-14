"""Genera plantilla-ventas-landur.xlsx: la planilla de ventas pensada para sincronizar con LANDUR y
para que se la cargue una persona o una IA sin romper nada.

Es un superconjunto del formato que usa el dueño hoy (mismos encabezados que LANDUR lee) con lo que
hacía fallar la sincronía resuelto de raíz:
  - Fecha REAL obligatoria (no «Setiembre 16», no el día suelto, no vacía).
  - Nro. Pedido obligatorio y único (la mayorista usa M-001, M-002...).
  - Estado, Canal y demás con listas cerradas.
  - Una sola pestaña «Ventas» para minorista y mayorista (Canal = Mayorista).
  - Las columnas que se ESCRIBEN van contiguas (A a P) y las fórmulas al final (Q a S): pegar una tabla
    encima nunca pisa una fórmula. MP Neto, Ganancia Bruta y Control son fórmulas.
  - «Control» dice por fila si lo cargado está bien; la pestaña «Resumen» dice qué tiene que mostrar LANDUR.
Incluye los datos reales disponibles (extracto del fragmento y de la planilla del 24/10); lo que no trae
el día queda marcado «Provisorio» en Notas.
Uso: python generar-plantilla.py  (necesita openpyxl)
"""
import datetime
from pathlib import Path
from openpyxl import Workbook
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.worksheet.datavalidation import DataValidation

# Los nombres de la fila 1 son un contrato con LANDUR: tests/integrations.test.mjs los lee de acá.
HEADERS = ["Fecha","Cliente","Canal","Nro. Pedido","Metodo de pago","Pedido","Unidades","Estado","Bruto","MP Fee","Material","Envío","Metodo de Envío","Pago del envio","Transf.","Notas","MP Neto","Ganancia Bruta","Control"]
INPUTS = HEADERS[:16]  # lo que se escribe: de «Fecha» a «Notas»
LAST = 500  # filas con validación y fórmulas
D = datetime.date

# ---- Datos disponibles ------------------------------------------------------------------------------
# (Fecha, Cliente, Canal, Nro. Pedido, Metodo de pago, Pedido, Unidades, Estado, Bruto, MP Fee, Material,
#  Envío, Metodo de Envío, Pago del envio, Transf., Notas)
PROV_DAY = "Provisorio: la planilla original no trae el día; se fechó el 1 del mes. Corregir con el día real."
PROV_NUM = " El Nro. Pedido M-xxx lo asignó LANDUR: reemplazarlo por el real si existe."
ROWS = [
    # Minorista, planilla del 24/10 (tramo de septiembre). Transf. tal cual la carga el cliente.
    (D(2026, 9, 16), "Milton Guevara", "Instagram", "IG0001", "Efectivo", "1 Ilumimate1 caja (Negro)", 1, "Enviado", 390, 0, 40, 0, "Retiro", "Nadie", False, ""),
    (D(2026, 9, 16), "Adrian Pinazo Bermudez", "Web", "#1112", "MP", "1 Ilumimate1 caja (Negro)", 1, "Enviado", 650, 68, 40, 260, "Ues", "Cliente", False, ""),
    (D(2026, 9, 16), "Elena Bizzotto", "Web", "#1113", "MP", "2 Decantadores Mundo", 2, "Enviado", 2980, 309, 1460, 260, "Ues", "Landur", False, ""),
    (D(2026, 9, 16), "Gisell Mariano", "Web", "#1114", "MP", "1 Ilumimate1 caja (Naranja)", 1, "Enviado", 650, 68, 40, 260, "Ues", "Cliente", False, ""),
    (D(2026, 9, 17), "Francisco Ruiz", "Web", "#1115", "MP", "2 ilumimate1 caja (Verde)", 2, "Enviado", 970, 101, 80, 190, "Ues", "Cliente", False, ""),
    (D(2026, 9, 18), "Marcela Gomez", "Web", "#1116", "MP", "2 ilumimate1 caja (Negro)", 2, "Enviado", 1040, 108, 80, 260, "Ues", "Cliente", False, ""),
    (D(2026, 9, 18), "Jorge Varela", "Web", "#1117", "MP", "2 ilumimate1 caja (Negro)", 2, "Enviado", 1040, 108, 80, 260, "Ues", "Cliente", False, ""),
    # Minorista, «Fragmento contabilidad Landur» (noviembre).
    (D(2026, 11, 8), "Esteban Fernandez", "Web", "#1275", "MP", "2 ilumimate1 (Negro)", 2, "Enviado", 970, 101, 80, 190, "Ues", "Cliente", False, ""),
    (D(2026, 11, 9), "Patricia Martinez", "Web", "#1276", "MP", "1 Set Decantador Mundo", 1, "Enviado", 1680, 174, 730, 190, "Ues", "Cliente", False, ""),
    (D(2026, 11, 9), "Mónica Elena Pereira Goicoechea", "Web", "#1277", "MP", "3 ilumimate 2.0 (Verde)", 3, "Enviado", 1730, 180, 120, 260, "Ues", "Cliente", False, ""),
    # Mayorista, planilla del 24/10 (octubre): sin día ni Nro. Pedido; sin comisión (MP Fee 0).
    (D(2026, 10, 1), "Matesuru", "Mayorista", "M-001", "", "Ilumimate caja", 50, "", 5000, 0, 2500, "", "", "", True, PROV_DAY + PROV_NUM),
    (D(2026, 10, 1), "ClienteB", "Mayorista", "M-002", "", "Ilumimate caja", 100, "", 10000, 0, 5000, "", "", "", True, PROV_DAY + PROV_NUM),
    (D(2026, 10, 1), "ClienteC", "Mayorista", "M-003", "", "Ilumimate placa", 200, "", 20000, 0, 10000, "", "", "", True, PROV_DAY + PROV_NUM),
    (D(2026, 10, 1), "ClienteD", "Mayorista", "M-004", "", "Ilumimate caja", 35, "", 3500, 0, 1750, "", "", "", True, PROV_DAY + PROV_NUM),
    (D(2026, 10, 1), "ClienteE", "Mayorista", "M-005", "", "Ilumimate caja", 120, "", 12000, 0, 6000, "", "", "", True, PROV_DAY + PROV_NUM),
    (D(2026, 10, 1), "ClienteF", "Mayorista", "M-006", "", "Yerbera250", 10, "", 1000, 0, 500, "", "", "", False, PROV_DAY + PROV_NUM),
    (D(2026, 10, 1), "ClienteG", "Mayorista", "M-007", "", "Yerbera500", 10, "", 1000, 0, 500, "", "", "", False, PROV_DAY + PROV_NUM),
    # Mayorista, «Fragmento contabilidad Landur» (noviembre).
    (D(2026, 11, 1), "Mateico", "Mayorista", "M-008", "", "Ilumimate placa", 30, "", 2940, 0, 750, "", "", "", True, PROV_DAY + PROV_NUM),
    (D(2026, 11, 1), "Mateico", "Mayorista", "M-009", "", "Ilumimate caja", 30, "", 5100, 0, 1200, "", "", "", True, PROV_DAY + PROV_NUM),
    (D(2026, 11, 1), "Vale Vieira", "Mayorista", "M-010", "", "Deadpool Joystick", 1, "", 840, 0, 555, "", "", "", True, PROV_DAY + PROV_NUM),
]

here = Path(__file__).parent
wb = Workbook()
ws = wb.active
ws.title = "Ventas"
ws.append(HEADERS)
col = {name: i + 1 for i, name in enumerate(HEADERS)}
letter = {name: ws.cell(row=1, column=col[name]).column_letter for name in HEADERS}  # «Fecha» -> «A»…

head_fill = PatternFill("solid", fgColor="242253")
calc_fill = PatternFill("solid", fgColor="5B7F73")
for index, cell in enumerate(ws[1], start=1):
    cell.font = Font(bold=True, color="FFFFFF")
    cell.fill = calc_fill if HEADERS[index - 1] in ("MP Neto", "Ganancia Bruta", "Control") else head_fill
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
ws.row_dimensions[1].height = 32
ws.freeze_panes = "A2"
widths = (12, 28, 12, 13, 15, 30, 10, 12, 11, 10, 11, 10, 15, 14, 10, 40, 11, 14, 34)
for index, width in enumerate(widths, start=1):
    ws.column_dimensions[ws.cell(row=1, column=index).column_letter].width = width

for row, data in enumerate(ROWS, start=2):
    for name, value in zip(INPUTS, data):
        if value != "":
            ws.cell(row=row, column=col[name], value=value)

L = letter  # alias corto para armar fórmulas
for row in range(2, LAST + 1):
    # Vacío si falta la comisión: no se calcula nada que la planilla no diga. Con MP Fee = 0 el neto es el bruto.
    ws.cell(row=row, column=col["MP Neto"], value=f'=IF(OR({L["Bruto"]}{row}="",{L["MP Fee"]}{row}=""),"",{L["Bruto"]}{row}-{L["MP Fee"]}{row})')
    ws.cell(row=row, column=col["Ganancia Bruta"], value=f'=IF({L["Bruto"]}{row}="","",{L["Bruto"]}{row}-N({L["MP Fee"]}{row})-N({L["Material"]}{row})-N({L["Envío"]}{row}))')
    # La primera falla que encuentra; «OK» si la fila está lista para LANDUR; vacío en una fila sin datos.
    transf = f'OR({L["Transf."]}{row}=TRUE,{L["Transf."]}{row}="TRUE")'
    ws.cell(row=row, column=col["Control"], value=(
        f'=IF(COUNTA({L["Fecha"]}{row}:{L["Bruto"]}{row})=0,"",'
        f'IF(NOT(ISNUMBER({L["Fecha"]}{row})),"Fecha inválida (dd/mm/aaaa)",'
        f'IF({L["Nro. Pedido"]}{row}="","Falta el Nro. Pedido",'
        f'IF(COUNTIF(${L["Nro. Pedido"]}$2:${L["Nro. Pedido"]}${LAST},{L["Nro. Pedido"]}{row})>1,"Nro. Pedido repetido",'
        f'IF(NOT(ISNUMBER({L["Bruto"]}{row})),"Falta el Bruto",'
        f'IF(AND({transf},{L["MP Fee"]}{row}=""),"Transf. TRUE: poné MP Fee (0 si no hubo comisión)","OK"))))))'))
    ws.cell(row=row, column=col["Fecha"]).number_format = "dd/mm/yyyy"
    for name in ("Bruto", "MP Fee", "Material", "Envío", "MP Neto", "Ganancia Bruta"):
        ws.cell(row=row, column=col[name]).number_format = "#,##0.##"


def validation(kind, name, title, message, **kwargs):
    dv = DataValidation(type=kind, allow_blank=True, showErrorMessage=True, errorStyle="stop", errorTitle=title, error=message, **kwargs)
    ws.add_data_validation(dv)
    dv.add(f"{L[name]}2:{L[name]}{LAST}")


validation("date", "Fecha", "Fecha", "Escribí una fecha completa, por ejemplo 08/11/2026.", operator="greaterThanOrEqual", formula1="43831")
validation("list", "Canal", "Canal", "Elegí un canal de la lista.", formula1='"Web,Instagram,WhatsApp,Mayorista,Local"')
validation("custom", "Nro. Pedido", "Nro. Pedido", "El número de pedido es obligatorio y no puede repetirse (mayorista: M-001, M-002...).", formula1=f'AND(LEN({L["Nro. Pedido"]}2)>0,COUNTIF(${L["Nro. Pedido"]}$2:${L["Nro. Pedido"]}${LAST},{L["Nro. Pedido"]}2)=1)')
validation("list", "Metodo de pago", "Método de pago", "Elegí un método de la lista.", formula1='"MP,Efectivo,Transferencia"')
validation("whole", "Unidades", "Unidades", "Las unidades son un número entero de 1 o más.", operator="greaterThanOrEqual", formula1="1")
validation("list", "Estado", "Estado", "Elegí un estado de la lista.", formula1='"Pendiente,Enviado,Entregado,Cancelado"')
validation("decimal", "Bruto", "Bruto", "El bruto es un importe mayor que cero.", operator="greaterThan", formula1="0")
for name in ("MP Fee", "Material", "Envío"):
    validation("decimal", name, "Importe", "Escribí un importe de cero o más (sin símbolos).", operator="greaterThanOrEqual", formula1="0")
validation("list", "Pago del envio", "Pago del envío", "Elegí Cliente, Landur o Nadie.", formula1='"Cliente,Landur,Nadie"')
validation("list", "Transf.", "Transf.", "Elegí TRUE (el dinero ya llegó) o FALSE.", formula1='"TRUE,FALSE"')

# Lo pegado se salta las validaciones: la columna «Control» y los colores son la red de seguridad.
ws.conditional_formatting.add(f'{L["Control"]}2:{L["Control"]}{LAST}', FormulaRule(formula=[f'AND({L["Control"]}2<>"",{L["Control"]}2<>"OK")'], fill=PatternFill("solid", bgColor="F4B6B0")))
ws.conditional_formatting.add(f'{L["Control"]}2:{L["Control"]}{LAST}', FormulaRule(formula=[f'{L["Control"]}2="OK"'], fill=PatternFill("solid", bgColor="CFE8DC")))
ws.conditional_formatting.add(f'{L["Nro. Pedido"]}2:{L["Nro. Pedido"]}{LAST}', FormulaRule(formula=[f'AND({L["Nro. Pedido"]}2<>"",COUNTIF(${L["Nro. Pedido"]}$2:${L["Nro. Pedido"]}${LAST},{L["Nro. Pedido"]}2)>1)'], fill=PatternFill("solid", bgColor="F4B6B0")))
ws.conditional_formatting.add(f'A2:{L["Notas"]}{LAST}', FormulaRule(formula=[f'LEFT(${L["Notas"]}2,9)="Provisorio"'], fill=PatternFill("solid", bgColor="FFF4CC")))
ws.conditional_formatting.add(f'A2:{L["Notas"]}{LAST}', FormulaRule(formula=[f'${L["Estado"]}2="Cancelado"'], font=Font(color="999999", strike=True)))
ws.auto_filter.ref = f'A1:{L["Control"]}{LAST}'

# ---- Resumen -----------------------------------------------------------------------------------------
V = lambda name: f"Ventas!${L[name]}$2:${L[name]}${LAST}"
summary = wb.create_sheet("Resumen")
summary.column_dimensions["A"].width = 62
summary.column_dimensions["B"].width = 18
summary.column_dimensions["C"].width = 70
not_cancelled = f'{V("Estado")},"<>Cancelado"'
lines = [
    ("QUÉ TIENE QUE MOSTRAR LANDUR (sin contar el saldo inicial de la cuenta)", None, "title"),
    ("Ventas (Bruto, sin canceladas)", f'=SUMIFS({V("Bruto")},{not_cancelled})', "Igual a «Ventas» en LANDUR"),
    ("Cantidad de ventas", f'=COUNTIFS({V("Bruto")},">0",{not_cancelled})', ""),
    ("Cobrado (Bruto de las filas con Transf. TRUE)", f'=SUMIFS({V("Bruto")},{V("Transf.")},TRUE,{not_cancelled})', "Solo estas filas generan cobro"),
    ("Comisiones de lo cobrado", f'=SUMIFS({V("MP Fee")},{V("Transf.")},TRUE,{not_cancelled})', "Cuentan como gasto"),
    ("Material (de todas las ventas)", f'=SUMIFS({V("Material")},{not_cancelled})', "Cuenta como gasto, esté cobrada o no"),
    ("Envío (de todas las ventas)", f'=SUMIFS({V("Envío")},{not_cancelled})', "Cuenta como gasto, esté cobrada o no"),
    ("Gastos esperados en LANDUR", "=B5+B6+B7", "Igual a «Gastos» en LANDUR (si no hay otros gastos cargados)"),
    ("Saldo esperado en LANDUR (más el saldo inicial)", "=B4-B8", "Es lo que se suma al saldo de la cuenta"),
    ("", None, ""),
    ("CONTROL DE LA CARGA", None, "title"),
    ("Filas con algún problema (columna Control)", f'=SUMPRODUCT(({V("Control")}<>"OK")*({V("Control")}<>""))', "Tiene que ser 0 antes de sincronizar"),
    ("Filas provisorias (día o número a confirmar)", f'=COUNTIF({V("Notas")},"Provisorio*")', "Reemplazarlas por las reales"),
]
for index, (label, formula, note) in enumerate(lines, start=1):
    summary.cell(row=index, column=1, value=label)
    if formula is not None:
        summary.cell(row=index, column=2, value=formula).number_format = "#,##0.##"
    if note == "title":
        for c in (1, 2, 3):
            summary.cell(row=index, column=c).fill = head_fill
            summary.cell(row=index, column=c).font = Font(bold=True, color="FFFFFF")
    else:
        summary.cell(row=index, column=3, value=note).font = Font(color="777777")

# ---- Importar con IA -----------------------------------------------------------------------------------
ai = wb.create_sheet("Importar con IA")
ai.column_dimensions["A"].width = 130
header_list = " | ".join(INPUTS)
ai_lines = [
    ("CÓMO CARGAR LOS DATOS REALES CON UNA IA", "title"),
    ("1. Abrí tu IA (ChatGPT, Claude, Gemini...), pegale el texto de abajo y adjuntale tus planillas (Minorista y Mayorista, como archivo o pegadas).", ""),
    ("2. La IA te devuelve una tabla. Copiala SIN la fila de títulos y pegala en la pestaña «Ventas», en la celda A2 (Edición → Pegado especial → Solo valores).", ""),
    ("3. Mirá la columna «Control» de Ventas: tiene que decir OK en todas las filas. Mirá también la pestaña «Resumen».", ""),
    ("4. Las filas con Notas «Provisorio» son datos de muestra del extracto: reemplazalas por las reales (borrar una fila no rompe nada: LANDUR revierte lo suyo).", ""),
    ("5. Listo: la planilla y LANDUR se sincronizan solas (ver «Instrucciones»).", ""),
    ("", ""),
    ("TEXTO PARA PEGARLE A LA IA", "title"),
    ("Convertí mis ventas (pestañas Minorista y Mayorista) al formato de la pestaña «Ventas» de LANDUR.", "code"),
    ("Devolvé UNA sola tabla (TSV, sin título ni explicación) con EXACTAMENTE estas 16 columnas y en este orden:", "code"),
    (header_list, "code"),
    ("Reglas:", "code"),
    ("- Una fila por venta. No incluyas filas de totales, de títulos ni filas sin importe.", "code"),
    ("- Fecha: dd/mm/aaaa completa (por ejemplo 08/11/2026). Si la planilla escribe solo el mes («Octubre») o solo el día, usá el año y mes que correspondan; si no hay día, poné el día 01 y escribí en Notas: «Provisorio: la planilla original no trae el día».", "code"),
    ("- Canal: Web, Instagram, WhatsApp, Mayorista o Local. Las ventas de la pestaña Mayorista llevan Canal = Mayorista.", "code"),
    ("- Nro. Pedido: obligatorio y ÚNICO. Minorista: el de la tienda (#1275, IG0001). Mayorista: M-001, M-002... (continuá la numeración y escribilo en Notas).", "code"),
    ("- Metodo de pago: MP, Efectivo o Transferencia (vacío si no se sabe). Estado: Pendiente, Enviado, Entregado o Cancelado (vacío si no se sabe).", "code"),
    ("- Bruto, MP Fee, Material y Envío: solo números, sin símbolos ni separador de miles. Material = costo real (no el «+10%»).", "code"),
    ("- MP Fee: la comisión de Mercado Pago. Poné 0 si no hubo comisión (efectivo, transferencia, mayorista). No lo dejes vacío en una fila cobrada.", "code"),
    ("- Transf.: TRUE si el dinero ya llegó, FALSE si no. Copialo tal cual de la columna «Transf.» de mi planilla.", "code"),
    ("- NO incluyas las columnas MP Neto, Ganancia Bruta ni Control (son fórmulas) ni las de reparto (Rafa, Luis, Reinversión...).", "code"),
    ("- No inventes datos: lo que no sepas, dejalo vacío y avisalo en Notas.", "code"),
]
for text, kind in ai_lines:
    ai.append([text])
    cell = ai.cell(row=ai.max_row, column=1)
    cell.alignment = Alignment(wrap_text=True, vertical="top")
    if kind == "title":
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = head_fill
    elif kind == "code":
        cell.font = Font(name="Consolas", size=10)
        cell.fill = PatternFill("solid", fgColor="F2F4F3")

# ---- Instrucciones -------------------------------------------------------------------------------------
guide = wb.create_sheet("Instrucciones")
guide.column_dimensions["A"].width = 120
rules = [
    ("CÓMO SE USA ESTA PLANILLA", "title"),
    ("Una fila = una venta. Minorista y mayorista van en la misma pestaña «Ventas» (columna Canal).", ""),
    ("No cambies los nombres de la fila 1: LANDUR los lee. Podés agregar columnas propias a la derecha (Reinversión, Rafa, Luis...): LANDUR las ignora.", ""),
    ("Las columnas verdes (MP Neto, Ganancia Bruta, Control) son fórmulas: no se escriben. Las que se escriben van de «Fecha» a «Notas».", ""),
    ("Para cargar datos reales con una IA mirá la pestaña «Importar con IA». Para comprobar que todo coincide con LANDUR, la pestaña «Resumen».", ""),
    ("", ""),
    ("REGLAS", "title"),
    ("Fecha: siempre la fecha completa (08/11/2026). Nunca «Setiembre 16», nunca solo el día, nunca vacía.", ""),
    ("Nro. Pedido: obligatorio y único. Minorista: el de la tienda (#1275). Mayorista: M-001, M-002... La planilla marca en rojo un repetido.", ""),
    ("Estado: Pendiente, Enviado, Entregado o Cancelado. Al pasar un pedido a Cancelado, LANDUR revierte la venta, el cobro y los gastos.", ""),
    ("Bruto: lo que paga el cliente (incluye el envío si se lo cobrás).", ""),
    ("Transf.: TRUE cuando el dinero ya llegó, FALSE si no. Es lo que decide el cobro: sin TRUE LANDUR registra la venta pero no el cobro. Si la pasás de TRUE a FALSE, LANDUR revierte el cobro.", ""),
    ("MP Fee: la comisión de Mercado Pago. 0 = cobrado sin comisión (efectivo, transferencia, mayorista). Con Transf. en TRUE hace falta (vacío = no se registra el cobro).", ""),
    ("Material y Envío: los costos de esa venta. LANDUR los registra como gasto de la cuenta elegida (categorías Materiales y Envíos), esté cobrada o no.", ""),
    ("Ganancia Bruta = Bruto - MP Fee - Material - Envío. El saldo de la cuenta en LANDUR suma esto solo de las filas con Transf. en TRUE (más el saldo inicial).", ""),
    ("", ""),
    ("EDITAR Y BORRAR ES SEGURO", "title"),
    ("Si corregís un importe, una fecha o la comisión, o borrás una fila, LANDUR revierte lo anterior y registra lo nuevo. Queda en el historial; nada se pierde.", ""),
    ("Si ya hay un cobro cargado a mano en LANDUR para esa venta, LANDUR no lo toca y avisa.", ""),
    ("", ""),
    ("EN LANDUR (Conexiones → Google Sheets) — para quien administra LANDUR", "title"),
    ("Pestaña: Ventas · Mes de la planilla: dejar vacío · Cuenta: la cuenta donde entra la plata · Estados que cuentan como cobrado: vacío · Costo de material: Material.", ""),
    ("Compartí esta planilla (permiso de lector) con el correo de la cuenta de servicio de Google (termina en .iam.gserviceaccount.com).", ""),
    ("El saldo inicial (corte) de la cuenta en LANDUR tiene que ser anterior a la fecha de la venta más vieja de la planilla (16/09/2026).", ""),
    ("", ""),
    ("SINCRONIZACIÓN AUTOMÁTICA", "title"),
    ("LANDUR lee esta planilla solo, cada pocos minutos, con su cuenta de servicio de Google. No hace falta instalar nada para que funcione.", ""),
    ("Opcional, para que los cambios aparezcan al instante: Extensiones → Apps Script → pegá el código de abajo → ejecutá configurar() y después instalar() (una vez cada una). El token te lo pasa quien administra LANDUR.", ""),
    ("Con el Apps Script, cada edición avisa a LANDUR y hay un latido cada 5 minutos.", ""),
    ("", ""),
    ("SI CAMBIA EL DUEÑO DE LA PLANILLA", "title"),
    ("Los permisos ya dados se mantienen (incluida la lectura de la cuenta de servicio): la sincronización sigue igual, sin tocar nada.", ""),
    ("Lo único que no se traspasa es el Apps Script opcional: sus disparadores quedan a nombre de quien los instaló. El nuevo dueño lo reinstala ejecutando instalar() (borra los anteriores y crea los suyos).", ""),
    ("No hace falta volver a cargar datos ni reconectar nada en LANDUR: la conexión apunta a esta planilla, no a su dueño.", ""),
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

wb.move_sheet("Resumen", offset=0)
out = here / "plantilla-ventas-landur.xlsx"
wb.save(out)
print("OK", out, "filas de datos:", len(ROWS))
