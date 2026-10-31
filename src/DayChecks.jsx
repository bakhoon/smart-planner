import { toggleDayDone } from './db.js';
import { weekdayLong, weekdayName } from './dates.js';
import { tr } from './i18n.js';
import * as I from './icons.jsx';

const MON_FIRST = [1, 2, 3, 4, 5, 6, 0];
const NO_DAYS = [false, false, false, false, false, false, false];

// Monday-to-Sunday checks: planned days can be ticked, other days are greyed out
export default function DayChecks({ t, highlight }) {
  const days = t.days || NO_DAYS;
  const doneDays = t.daysDone || NO_DAYS;
  if (!days.some(Boolean)) return null;
  return (
    <div className="day-checks" role="group" aria-label={tr('요일 체크')}>
      {MON_FIRST.map((wd, i) => (days[i] ? (
        <button key={i} className={'dchk' + (doneDays[i] ? ' on' : '') + (highlight === i ? ' here' : '')}
          aria-pressed={doneDays[i]} aria-label={tr('{d} 했어요', { d: weekdayLong(wd) })}
          onClick={() => toggleDayDone(t, i)}>
          {doneDays[i] ? <I.CheckMark size={10} /> : weekdayName(wd).slice(0, 1)}
        </button>
      ) : (
        <span key={i} className="dchk off" aria-hidden="true">{weekdayName(wd).slice(0, 1)}</span>
      )))}
    </div>
  );
}

