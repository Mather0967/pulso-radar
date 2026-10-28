// Disponible estimado: se calcula en el servidor en tiempo real.
//
// Por defecto se descuentan todas las obligaciones pendientes y aplicamos un reserva del
// 30 % sobre el saldo (es configurable en /api/settings). No se descuenta una obligación
// que ya se pagó parcialmente más de su importe: esa parte pendiente baja de la reserva.
export function estimateAvailable({ account, totals, policy, pending }) {
  const units = totals.filter(t => t.currency === account.currency);
  const balance = units[0]?.balance ?? 0;
  const reserve = Math.round(balance * policy.reservePercent / 100);
  const fromBalance = Math.max(0, balance - reserve);
  const unpaid = pending
    .filter(o => o.kind === 'obligation' && o.currency === account.currency)
    .map(o => Math.max(0, o.amount - o.applied))
    .reduce((sum, v) => sum + v, 0);
  return Math.max(0, fromBalance - unpaid);
}

export function estimateTotals({ totals, policy, pending }) {
  const currency = totals[0]?.currency ?? '';
  const balance = totals[0]?.balance ?? 0;
  const reserve = Math.round(balance * policy.reservePercent / 100);
  const unpaid = pending
    .filter(o => o.kind === 'obligation')
    .map(o => Math.max(0, o.amount - o.applied))
    .reduce((sum, v) => sum + v, 0);
  const amount = Math.max(0, balance - reserve - unpaid);
  return { currency, amount, reserve, unpaidObligations: unpaid, policy };
}
