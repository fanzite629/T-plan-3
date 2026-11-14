(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TGCalendar = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400000;
  const SHANGHAI_OFFSET = 8 * 60 * 60 * 1000;
  const TERM_START = '2026-09-07';
  const TERM_END = '2027-01-24';
  const UNVERIFIED_2027 = '2027年完整放假调休安排尚未核实，不能据此判断学校停课或补课；基础课表保留。';
  const sources = Object.freeze([
    Object.freeze({
      title: '国务院办公厅关于2026年部分节假日安排的通知（国办发明电〔2025〕7号，2025-11-04）',
      url: 'https://www.beijing.gov.cn/cs/gncs/zcwj/202603/t20260327_4568275.html',
      verifiedOn: '2026-09-07'
    }),
    Object.freeze({
      title: '国务院关于修改《全国年节及纪念日放假办法》的决定（国务院令第795号，2024-11-10）',
      url: 'https://www.gov.cn/zhengce/content/202411/content_6986380.htm?ddtab=true',
      verifiedOn: '2026-09-07'
    })
  ]);
  const events = Object.freeze([
    Object.freeze({
      id: 'modeling-20260910',
      name: '数学建模',
      location: '三教',
      start: '2026-09-10T18:00:00+08:00',
      end: '2026-09-14T00:00:00+08:00',
      leaveNote: '老师安排请假（用户提供）'
    })
  ]);

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('日期格式必须为 YYYY-MM-DD');
    const parsed = new Date(value + 'T00:00:00Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('日期不存在：' + value);
    return value;
  }
  function inTerm(value) { return value >= TERM_START && value <= TERM_END; }
  function nextDate(value, offset) {
    return new Date(Date.parse(value + 'T00:00:00Z') + offset * DAY).toISOString().slice(0, 10);
  }
  function holidayForDate(value) {
    validDate(value);
    if (!inTerm(value)) return null;
    if (value >= '2026-09-25' && value <= '2026-09-27') {
      return { label: '中秋节', kind: 'holiday', note: '全国放假安排：9月25–27日；学校停课、补课安排待核实，基础课表保留。' };
    }
    if (value >= '2026-10-01' && value <= '2026-10-07') {
      return { label: '国庆节', kind: 'holiday', note: '全国放假调休安排：10月1–7日；学校停课、补课安排待核实，基础课表保留。' };
    }
    if (value === '2026-09-20' || value === '2026-10-10') {
      return { label: '全国调休上班日', kind: 'workday', note: '全国调休上班日；不代表学校已确认补课，不映射其他星期课程，学校安排待核实。' };
    }
    if (value === '2027-01-01') {
      return { label: '元旦（法定日期）', kind: 'statutory', note: '仅确认1月1日为元旦法定日期；' + UNVERIFIED_2027 };
    }
    return null;
  }
  function clockText(milliseconds) { return new Date(milliseconds + SHANGHAI_OFFSET).toISOString().slice(11, 16); }
  function eventsForDate(value) {
    validDate(value);
    // Fixed China time makes this result independent of the host browser's timezone.
    const dayStart = Date.parse(value + 'T00:00:00+08:00');
    const dayEnd = dayStart + DAY;
    return events.filter(event => Date.parse(event.start) < dayEnd && Date.parse(event.end) > dayStart).map(event => {
      const from = Math.max(dayStart, Date.parse(event.start));
      const until = Math.min(dayEnd, Date.parse(event.end));
      const fullDay = from === dayStart && until === dayEnd;
      const start = clockText(from), end = until === dayEnd ? '24:00' : clockText(until);
      const note = fullDay
        ? '全天参加' + event.name + '，地点' + event.location + '；' + event.leaveNote + '。'
        : start + '后参加' + event.name + '，地点' + event.location + '；' + event.leaveNote + '。白天课程保留；晚间对应节次起止时间待核实。';
      return { ...event, dayStart: start, dayEnd: end, fullDay, note };
    });
  }
  function parseNow(value) {
    if (value === undefined) return Date.now();
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new Error('当前时间须为包含时区的 ISO 时间戳');
    validDate(value.slice(0, 10));
    const offset = value.match(/([+-])(\d{2}):(\d{2})$/);
    if (+value.slice(11, 13) > 23 || +value.slice(14, 16) > 59 || +value.slice(17, 19) > 59 || (offset && (+offset[2] > 23 || +offset[3] > 59))) throw new Error('时间戳数值无效');
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) throw new Error('时间戳无效');
    return parsed;
  }
  function eventStatus(eventId, isoNow) {
    const event = events.find(item => item.id === eventId);
    if (!event) throw new Error('找不到日历活动：' + eventId);
    const now = parseNow(isoNow);
    return now < Date.parse(event.start) ? 'upcoming' : now >= Date.parse(event.end) ? 'ended' : 'active';
  }
  function dateNotes(value) {
    validDate(value);
    const notes = eventsForDate(value).map(event => event.name + ' · ' + event.dayStart + '–' + event.dayEnd + ' · ' + event.note);
    const holiday = holidayForDate(value);
    if (holiday) notes.push(holiday.label + '：' + holiday.note);
    if (inTerm(value) && value >= '2027-01-01' && (!holiday || holiday.kind !== 'statutory')) notes.push(UNVERIFIED_2027);
    return notes;
  }
  function annotation(value) {
    validDate(value);
    const todayEvents = eventsForDate(value);
    if (todayEvents.length) {
      const event = todayEvents[0];
      return { label: event.fullDay ? '数学建模 · 全天请假' : '数学建模 · 18:00后请假', kind: event.fullDay ? 'leave' : 'partial-leave', note: event.note };
    }
    const holiday = holidayForDate(value);
    if (holiday) return { label: holiday.label, kind: holiday.kind === 'workday' ? 'workday' : 'holiday', note: holiday.note };
    if (inTerm(value) && value >= '2027-01-01') return { label: '放假调休待核实', kind: 'unknown', note: UNVERIFIED_2027 };
    return { label: '', kind: '', note: '' };
  }
  function weekText(monday) {
    validDate(monday);
    if (new Date(monday + 'T00:00:00Z').getUTCDay() !== 1) throw new Error('周日历起始日期必须为周一');
    const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    return Array.from({ length: 7 }, (_, offset) => {
      const value = nextDate(monday, offset), notes = dateNotes(value);
      return value + ' ' + weekdays[offset] + '：' + (notes.length ? notes.join('；') : inTerm(value) ? '无已登记日历提示' : '本学期日历覆盖范围外');
    }).join('\n');
  }
  return { sources, events, holidayForDate, eventsForDate, eventStatus, dateNotes, weekText, annotation };
});
