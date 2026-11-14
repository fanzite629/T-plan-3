'use strict';
// Export only timetable configuration, never the personal database or API keys.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const courses = require(path.join(root, 'courses.js'));
const calendar = require(path.join(root, 'calendar.js'));
const startDate = '2026-09-07';
const totalWeeks = 20;
const addDays = (date, offset) => new Date(Date.parse(date + 'T00:00:00Z') + offset * 86400000).toISOString().slice(0, 10);
const endDate = addDays(startDate, totalWeeks * 7 - 1);
const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const generatedAt = new Date().toISOString();
const stamp = new Date(Date.now() + 8 * 3600000).toISOString().replace(/[-:]/g, '').slice(0, 15).replace('T', '-');
const out = path.join(root, 'exports', 'T成长课表_Codex读取包_' + stamp);
const desktopHtml = fs.readFileSync(path.join(root, 'v3-desktop', 'index.html'), 'utf8');
const match = desktopHtml.match(/^const SCHED=(.*);$/m);
assert(match, 'Cannot find the v3 timetable');
const v3 = JSON.parse(match[1]);
assert(desktopHtml.includes("const SEM='" + startDate + "'"));
assert.deepEqual(v3.profile, courses.personalProfile);
for (let week = 1; week <= totalWeeks; week++) {
  const rows = courses.forWeek(week).map(c => [c.day, c.slot, c.displayName || c.name, c.room, c.teacher,
    c.attendanceStatus, c.statusLabel, c.attendanceNotice || c.notice, c.id]);
  assert.deepEqual(rows, v3.weeks[week], 'v3 timetable differs in week ' + week);
}
const decorate = item => ({...item, periodStart: item.slot * 2 - 1, periodEnd: item.slot * 2,
  periodLabel: `${item.slot * 2 - 1}–${item.slot * 2}节`, clockStart: null, clockEnd: null});
const days = Array.from({length: totalWeeks * 7}, (_, i) => {
  const date = addDays(startDate, i), day = i % 7 + 1, week = Math.floor(i / 7) + 1;
  assert.deepEqual(v3.ann[date] || ['', '', ''], [calendar.annotation(date).kind, calendar.annotation(date).label, calendar.annotation(date).note]);
  return {date, weekday: weekdays[day - 1], day, teachingWeek: week,
    formalCourses: courses.forDay(week, day).map(decorate),
    optionalCourses: courses.optionalForWeek(week).filter(c => c.day === day).map(decorate),
    dateNotes: calendar.dateNotes(date), annotation: calendar.annotation(date), specialEvents: calendar.eventsForDate(date)};
});
const limitations = [
  '本包是 T成长本地配置在导出时的快照，覆盖 2026-09-07 至 2027-01-24；不自动同步后续调课。',
  '节次是第1–2、3–4、5–6、7–8、9–10节，尚无完整核实的上课钟点，clockStart/clockEnd 为 null。',
  'attendanceStatus 是排课占用状态；normal 不代表实际出勤，occupied 表示本次理论课被实验占用。',
  '旁听为可选机会，正式课程和实验优先；固定课表无冲突不保证实际可以参加。',
  '节假日提示沿用原程序固定配置与原核对日期；本次未重新联网核实，不据此自动停课或补课。',
  '教师、教室、分组实验课程名等标为待确认的字段保留原样；临时调课以学校通知为准。',
  '本包只有课表与相关日历，不含个人任务、学习记录、体重、API 密钥或数据库。'
];
const data = {schemaVersion: 1, generatedAt, timezone: 'Asia/Shanghai',
  term: {label: '2026—2027学年第一学期', startDate, endDate, totalWeeks}, profile: courses.personalProfile,
  definitions: courses.courses.map(decorate), courseEvents: courses.events, pendingNotices: courses.pendingNotices,
  scheduleExceptions: courses.scheduleExceptions, calendarSources: calendar.sources,
  specialEvents: calendar.events, limitations, days};
fs.mkdirSync(path.join(out, 'source'), {recursive: true});
const write = (name, text) => fs.writeFileSync(path.join(out, name), text, 'utf8');
write('schedule.json', JSON.stringify(data, null, 2) + '\n');
write('v3-schedule-snapshot.json', JSON.stringify(v3, null, 2) + '\n');
for (const name of ['courses.js', 'calendar.js']) fs.copyFileSync(path.join(root, name), path.join(out, 'source', name));
fs.copyFileSync(path.join(__dirname, 'schedule-reader.py'), path.join(out, 'query_schedule.py'));
const safe = value => String(value || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const lines = ['# T成长完整学期课表', '', `导出时间：${generatedAt}（UTC）；日期与教学周按北京时间。`, '', ...limitations.map(x => '- ' + x)];
for (let week = 1; week <= totalWeeks; week++) {
  const weekDays = days.filter(d => d.teachingWeek === week);
  lines.push('', `## 第${week}教学周 · ${weekDays[0].date} 至 ${weekDays[6].date}`, '',
    '| 日期 | 星期 | 节次 | 课程 | 教师 | 教室 | 排课状态及说明 |', '| --- | --- | --- | --- | --- | --- | --- |');
  for (const day of weekDays) for (const c of [...day.formalCourses, ...day.optionalCourses]) {
    const status = c.optional ? (c.conflict ? '可选旁听；与' + c.conflictNames.join('、') + '冲突，正式课优先' : '可选旁听；固定课表无冲突')
      : c.attendanceStatus === 'occupied' ? '被实验占用，本次理论课不上' : '正式课程';
    const note = [...new Set([status, c.notice, c.attendanceNotice].filter(Boolean))].join('；');
    lines.push('| ' + [day.date, day.weekday, c.periodLabel, c.displayName || c.name, c.teacher, c.room, note].map(safe).join(' | ') + ' |');
  }
  if (!weekDays.some(d => d.formalCourses.length || d.optionalCourses.length)) lines.push('', '本周未登记固定节次课程；课程设计提醒见下方。');
  for (const day of weekDays) if (day.dateNotes.length) lines.push('', `${day.date} 日历提示：${day.dateNotes.join('；')}`);
  for (const event of courses.events.filter(e => e.weeks.includes(week))) lines.push('', event.name + '：' + event.notice);
}
lines.push('', '## 待确认信息', '', ...courses.pendingNotices.map(x => '- ' + x.notice), '');
write('课表总览.md', lines.join('\n'));
write('AGENTS.md', `本目录是用户从 T成长导出的个人课表快照。\n\n先读 README.md，按需读 schedule.json 或运行 query_schedule.py。不要把源程序中的 normal 状态当作已出勤，也不要从课表推断已学习或已掌握。对时间未知、地点待确认、节假日学校安排未核实等限制，应按数据原样说明。只回答本学期已登记的安排；临时调课应由用户提供新证据。\n`);
write('发给台式机Codex.txt', `请读取这个文件所在文件夹里的 README.md 和 schedule.json，将它作为我 2026—2027 学年第一学期的课表来源。需要查某一天或某一周时，可用 query_schedule.py 按日期或教学周查询；没有 Python 也可直接读取课表总览.md 或 JSON。日期按北京时间；保留实验占课、可选旁听及冲突提示，不把 normal 当作实际出勤，不猜测未知的上课钟点或学校调课。现在请先告诉我本学期起止日期、按当前北京时间计算的教学周和本周剩余的已登记课程，并说明待确认信息。\n`);
write('README.md', `# T成长课表 · 给台式机 Codex 的离线读取包

把整个压缩包发到台式机并解压，然后把“发给台式机Codex.txt”里的文字粘贴给那边的 Codex，同时提供解压文件夹路径。

直接读取不需要安装 T成长、Node.js 或 Python，也不需要 API Key。要运行查询程序才需要 Python 3.8+，无第三方依赖。

- schedule.json：首选结构化数据。包含完整20教学周、140个日期、课程定义、按日期展开的正式课程/旁听、占课规则、日历和待确认信息。
- 课表总览.md：可直接阅读的完整学期课表。
- query_schedule.py：独立离线查询程序，不读取原电脑任何路径。
- source/courses.js、source/calendar.js：原始课表与日历程序，可供复用。
- v3-schedule-snapshot.json：从桌面v3程序提取的内置课表，已与源配置逐周核对。
- manifest.json：源文件哈希、数量和导出校验信息。
- checksums.sha256：包内文件的 SHA-256 校验值。

## 查询方法

在解压文件夹内运行（Windows 也可把 python 替换为 py -3）：

~~~powershell
python .\\query_schedule.py
python .\\query_schedule.py --date 2026-11-05
python .\\query_schedule.py --week 9
python .\\query_schedule.py --course 传感器
python .\\query_schedule.py --date 2026-11-05 --json
~~~

不带参数按北京时间查询运行当天；--course 单独使用查询全学期；--date 和 --week 不能同时使用。

## 数据约定

day=1表示周一，7表示周日；slot=1表示第1–2节，依次到slot=5的第9–10节。weeks 为该课程实际适用的教学周列表。日期已展开，不必自行推算单双周。days[].formalCourses 保留被实验占用的理论课；只筛 attendanceStatus=normal 才是按原程序规则应上的正式课程。optionalCourses 为旁听，conflict=true 表示正式课程冲突。无固定节次课程不等于没有课程设计或临时安排，另读 courseEvents 和 dateNotes。

学期：${startDate} 至 ${endDate}；第1周周一为 ${startDate}，共${totalWeeks}周。导出时间 ${generatedAt}。

${limitations.map(x => '- ' + x).join('\n')}

## 后续更新

这是离线快照。在原电脑项目中运行 node tools/export-schedule.cjs 可重新生成读取包文件夹，重新压缩传输；台式机解压后即可读取新数据。原程序固定配置发生变化时需要重新核对，导出器会拒绝打包与桌面v3不一致的课表。
`);
const hashFile = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const formalOccurrences = days.reduce((n, d) => n + d.formalCourses.length, 0);
write('manifest.json', JSON.stringify({schemaVersion: 1, generatedAt, term: data.term,
  counts: {definitions: data.definitions.length, days: days.length, formalOccurrences,
    optionalOccurrences: days.reduce((n, d) => n + d.optionalCourses.length, 0),
    occupiedTheoryOccurrences: days.flatMap(d => d.formalCourses).filter(c => c.attendanceStatus === 'occupied').length},
  verification: {v3FormalScheduleMatchesAll20Weeks: true, v3AnnotationsMatchAll140Days: true},
  sourceFiles: ['courses.js', 'calendar.js', 'v3-desktop/index.html', 'tools/export-schedule.cjs', 'tools/schedule-reader.py']
    .map(name => ({path: name, sha256: hashFile(path.join(root, name))}))}, null, 2) + '\n');
const files = fs.readdirSync(out, {recursive: true}).filter(name => fs.statSync(path.join(out, name)).isFile()).sort();
write('checksums.sha256', files.map(name => hashFile(path.join(out, name)) + '  ' + name.replace(/\\/g, '/')).join('\n') + '\n');
console.log(JSON.stringify({outputDirectory: out, formalOccurrences, days: days.length, definitions: data.definitions.length}, null, 2));
