import { hours, HOURS_NOTE } from '../../data/hours';
import { useNow } from '../../hooks/useNow';
import { getOpenStatus, nowInSaoPaulo } from '../../utils/hours';

export function Hours() {
  const now = useNow();
  const { weekday } = nowInSaoPaulo(now);
  const status = getOpenStatus(now);

  let statusText = 'Fechado agora';
  if (status.open) statusText = `Aberto agora · fecha às ${status.closesAt}`;
  else if (status.nextOpen)
    statusText = status.nextOpen.today
      ? `Fechado agora · abre hoje às ${status.nextOpen.at}`
      : `Fechado agora · abre ${status.nextOpen.label.toLowerCase()} às ${status.nextOpen.at}`;

  return (
    <div className="hours" id="horarios">
      <div className="hours__head">
        <h3 className="hours__title">Horários</h3>
        <p className="hours__status" data-open={status.open || undefined}>
          {statusText}
        </p>
      </div>
      <table className="hours__table">
        <caption className="sr-only">Horário de funcionamento da Food Street Augusta</caption>
        <tbody>
          {hours.map((h) => {
            const isToday = h.day === weekday;
            return (
              <tr key={h.day} data-today={isToday || undefined} aria-current={isToday ? 'date' : undefined}>
                <th scope="row">
                  {h.label}
                  {isToday ? <span className="hours__today">Hoje</span> : null}
                </th>
                <td className="tnum">{h.closed ? 'Fechado' : `${h.open} – ${h.close}`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="hours__note">{HOURS_NOTE}</p>
    </div>
  );
}
