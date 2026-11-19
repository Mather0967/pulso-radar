// Avisos del inicio del portal: trabajos próximos (hoy y los 7 días siguientes) que el usuario
// puede ver, y mensajes sin leer para administradores. Solo lectura. La visibilidad de los
// trabajos la decide calendar.listVisible, la misma regla que GET /api/calendar/jobs.
const MAX_UPCOMING = 20;
const DAYS_AHEAD = 7;

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

// Fecha de hoy en Montevideo como AAAA-MM-DD (en-CA ya usa ese formato).
const montevideoToday = now => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(now);

function addDays(isoDate, days) {
  const date = new Date(isoDate + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function createNotices({ calendar, store, unreadCount }) {
  return async function notices(req, user) {
    if (req.method !== 'GET') return json({ error: 'Método no admitido.' }, 405);
    try {
      const now = new Date();
      const today = montevideoToday(now);
      const to = addDays(today, DAYS_AHEAD);
      const jobs = await calendar.listVisible(user, { from: today, to });
      const isAdmin = user?.role === 'admin' && user?.active === true;
      const unreadMessages = isAdmin ? await unreadCount(store, user.id) : 0;
      return json({
        upcoming: jobs.slice(0, MAX_UPCOMING),
        unreadMessages,
        generatedAt: now.toISOString(),
      });
    } catch (error) {
      console.error('Avisos:', String(error?.message ?? 'error desconocido'));
      return json({ error: 'No se pudo completar la operación.' }, 500);
    }
  };
}
