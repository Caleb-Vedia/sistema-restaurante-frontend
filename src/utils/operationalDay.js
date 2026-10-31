const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/La_Paz', calendar: 'gregory', numberingSystem: 'latn',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function parts(now) {
  return Object.fromEntries(formatter.formatToParts(now).map(({ type, value }) => [type, value]));
}

export function operationalDate(now = new Date()) {
  const { year, month, day } = parts(now);
  return `${year}-${month}-${day}`;
}

export function untilOperationalMidnight(now = new Date()) {
  const { hour, minute, second } = parts(now);
  // La Paz no cambia de offset estacionalmente. Se usa su hora, no la local.
  return 86400000 - ((Number(hour) * 3600 + Number(minute) * 60 + Number(second)) * 1000
    + now.getUTCMilliseconds());
}

export function watchOperationalDay(onChange) {
  let timer;
  const sync = () => {
    const now = new Date();
    onChange(operationalDate(now));
    window.clearTimeout(timer);
    timer = window.setTimeout(sync, untilOperationalMidnight(now));
  };
  const onVisible = () => { if (document.visibilityState === 'visible') sync(); };
  sync();
  window.addEventListener('focus', sync);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener('focus', sync);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
