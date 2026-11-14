(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TG = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = 86400000;
  const CATEGORIES = [
    { id: 'school', label: '学校专业课', unit: '小时' },
    { id: 'english', label: '六级/英语', unit: '小时' },
    { id: 'math', label: '考研数学', unit: '小时' },
    { id: 'power', label: '电力系统分析', unit: '小时' },
    { id: 'agent', label: 'AI / Agent', unit: '小时' },
    { id: 'fitness', label: '健身', unit: '天' },
    { id: 'stocks', label: '财务/投资', unit: '小时' },
    { id: 'other', label: '其他', unit: '小时' }
  ];
  const KEYS = CATEGORIES.map(c => c.id);
  const LEGACY_KEYS = KEYS.filter(key => key !== 'agent');
  const STOCK_ALIASES = ['stocks', '股票/理财', '财务/投资'];
  const STATUSES = ['todo', 'doing', 'done'];
  const COURSE_PLAN_FIELDS = ['id', 'courseId', 'week', 'date', 'topic', 'preQuestions', 'minimumGoals', 'standardGoals', 'stretchGoals', 'evidence', 'reflection', 'unresolvedProblem', 'levelReached'];
  const COURSE_EVIDENCE = { explain: '我能不看教材解释核心概念', draw: '我能独立画出关键图/结构', solve: '我能独立完成基础题', teach: '我能把内容讲给别人', stuck: '我仍然存在卡点' };
  const COURSE_LEVELS = { unreviewed: '尚未复盘', minimum: '达到保底线', standard: '达到达标线', stretch: '达到进阶线', blocked: '存在卡点' };
  const own = (o, key) => Object.prototype.hasOwnProperty.call(o, key);
  const clone = value => JSON.parse(JSON.stringify(value));
  function fail(message) { throw new Error(message); }
  function check(condition, message) { if (!condition) fail(message); }
  function object(value, allowed, required, label) {
    check(value && typeof value === 'object' && !Array.isArray(value), label + '必须是对象');
    check(Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null, label + '原型无效');
    for (const key of Object.keys(value)) {
      check(!['__proto__', 'prototype', 'constructor'].includes(key), label + '包含不允许的键');
      check(!allowed || allowed.includes(key), label + '包含未知字段：' + key);
    }
    for (const key of required || []) check(own(value, key), label + '缺少字段：' + key);
  }
  function exact(value, keys, label) { object(value, keys, keys, label); }
  function str(value, max, label, nonempty) {
    check(typeof value === 'string' && value.length <= max && (!nonempty || value.trim().length > 0), label + '文本无效');
  }
  function number(value, min, max, label, integer = true) {
    check(typeof value === 'number' && Number.isFinite(value) && (!integer || Number.isInteger(value)) && value >= min && value <= max, label + '数值无效');
  }
  function date(value) {
    check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), '日期格式必须为 YYYY-MM-DD');
    const d = new Date(value + 'T00:00:00Z');
    check(Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value, '日期不存在：' + value);
    return value;
  }
  function timestamp(value) {
    check(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)), '时间戳无效');
    date(value.slice(0, 10));
    const hh = +value.slice(11, 13), mm = +value.slice(14, 16), ss = +value.slice(17, 19);
    check(hh <= 23 && mm <= 59 && ss <= 59, '时间戳无效');
    return value;
  }
  function today(input) {
    const d = input ? new Date(input) : new Date();
    check(Number.isFinite(d.getTime()), '时间无效');
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addDays(value, days) {
    date(value); number(days, -100000, 100000, '日期偏移');
    return new Date(new Date(value + 'T00:00:00Z').getTime() + days * DAY).toISOString().slice(0, 10);
  }
  function weekStart(value) {
    date(value);
    return addDays(value, -((new Date(value + 'T00:00:00Z').getUTCDay() + 6) % 7));
  }
  function weekDates(value) { const start = weekStart(value); return Array.from({ length: 7 }, (_, i) => addDays(start, i)); }
  function teachingWeek(value) { date(value); return Math.floor((Date.parse(value + 'T00:00:00Z') - Date.parse('2026-09-07T00:00:00Z')) / (7 * DAY)) + 1; }
  function remainingDays(value) { date(value); return 6 - ((new Date(value + 'T00:00:00Z').getUTCDay() + 6) % 7); }
  function zeroTotals() { return Object.fromEntries(KEYS.map(key => [key, 0])); }
  function defaultWeek() { return { budgetMinutes: 1800, goals: { school: 480, english: 420, math: 300, power: 300, agent: 210, fitness: 4, stocks: 0, other: 0 }, fitnessMinutes: 240 }; }
  function newState() {
    return { schemaVersion: 3, settings: { direction: '以考研准备为长期主线，优先完成本学期正式课程。', focus: '', defer: '', hideStocks: false }, weeks: {}, tasks: [], logs: [], health: [], mainByDate: {}, attendance: [], reviews: {}, courseLearningPlans: [] };
  }
  function id(value) { check(typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value), '记录 ID 无效'); return value; }
  function makeId(prefix) {
    const random = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);
    return prefix + '-' + random;
  }
  function goalValues(value, isActual, keys = KEYS) {
    exact(value, keys, '分类目标');
    for (const key of keys) number(value[key], 0, key === 'fitness' ? 7 : (isActual ? 100000000 : 10080), key + '目标');
  }
  function validateWeek(value, keys = KEYS) { exact(value, ['budgetMinutes', 'goals', 'fitnessMinutes'], '周计划'); number(value.budgetMinutes, 0, 10080, '本周预算'); number(value.fitnessMinutes, 0, 10080, '健身时间预算'); goalValues(value.goals, false, keys); }
  function getWeek(state, value) { const key = weekStart(value); return clone(own(state.weeks, key) ? state.weeks[key] : defaultWeek()); }
  function reflection(value) { exact(value, ['progress', 'adjustments', 'outcomes'], '复盘'); for (const key of Object.keys(value)) str(value[key], 20000, '复盘内容'); }
  function courseForPlan(plan) {
    const provider = typeof module === 'object' && module.exports && typeof require === 'function'
      ? require('./courses.js') : typeof globalThis !== 'undefined' ? globalThis.TGCourses : null;
    check(provider && Array.isArray(provider.courses), '课程数据尚未加载，不能验证课程学习计划');
    const course = provider.courses.find(item => item.id === plan.courseId);
    check(course, '课程学习计划引用的课程不存在');
    date(plan.date); number(plan.week, 1, 20, '教学周');
    check(teachingWeek(plan.date) === plan.week, '课程学习计划日期与教学周不一致');
    const day = ((new Date(plan.date + 'T00:00:00Z').getUTCDay() + 6) % 7) + 1;
    check(course.day === day && course.weeks.includes(plan.week), '该日期不在课程的基础课表安排中');
    return course;
  }
  function validateCoursePlan(plan) {
    exact(plan, COURSE_PLAN_FIELDS, '课程学习计划'); id(plan.id); id(plan.courseId); courseForPlan(plan);
    str(plan.topic, 500, '本节主题');
    for (const field of ['preQuestions', 'minimumGoals', 'standardGoals', 'stretchGoals']) {
      check(Array.isArray(plan[field]) && plan[field].length <= 50, '课程学习计划条目过多或格式无效');
      for (const item of plan[field]) str(item, 1000, '课程学习条目', true);
    }
    check(Array.isArray(plan.evidence) && plan.evidence.length <= 5, '学习证据格式无效');
    check(plan.evidence.every(item => typeof item === 'string' && own(COURSE_EVIDENCE, item)) && new Set(plan.evidence).size === plan.evidence.length, '学习证据未知或重复');
    str(plan.reflection, 10000, '本节学习成果'); str(plan.unresolvedProblem, 10000, '本节卡点');
    check(typeof plan.levelReached === 'string' && own(COURSE_LEVELS, plan.levelReached), '课程学习自评状态无效');
  }
  function validateState(state) { return validateStateShape(state, 3); }
  function validateStateShape(state, version) {
    const stateFields = ['schemaVersion', 'settings', 'weeks', 'tasks', 'logs', 'health', 'mainByDate', 'attendance', 'reviews'];
    if (version >= 3) stateFields.push('courseLearningPlans');
    object(state, version >= 3 ? [...stateFields, 'timerBoard', 'taskMaps'] : stateFields, stateFields, '数据');
    if (version >= 3 && own(state, 'timerBoard')) {
      const timer = typeof module === 'object' && module.exports ? require('./task-timer.js') : globalThis.TGTimer;
      check(!!timer, '计时模块未加载'); timer.validate(state.timerBoard);
    }
    if (version >= 3 && own(state, 'taskMaps')) { const maps=typeof module==='object'&&module.exports?require('./task-map.js'):globalThis.TGTaskMap; check(!!maps,'地图模块未加载'); maps.validateStore(state.taskMaps); }
    check(state.schemaVersion === version, '不支持的 schemaVersion');
    const categoryKeys = version === 1 ? LEGACY_KEYS : KEYS;
    exact(state.settings, ['direction', 'focus', 'defer', 'hideStocks'], '设置');
    for (const key of ['direction', 'focus', 'defer']) str(state.settings[key], 10000, '方向设置');
    check(typeof state.settings.hideStocks === 'boolean', '股票显示设置无效');
    object(state.weeks, null, [], '每周目标');
    for (const [key, value] of Object.entries(state.weeks)) { check(weekStart(key) === key, '周计划必须以周一为键'); validateWeek(value, categoryKeys); }
    for (const key of ['tasks', 'logs', 'health', 'attendance']) check(Array.isArray(state[key]) && state[key].length <= 100000, key + '数组无效或过大');
    const ids = new Set(), taskIds = new Set();
    const register = value => { id(value); check(!ids.has(value), '重复 ID：' + value); ids.add(value); };
    const planIds = new Set(), planKeys = new Set(), taskPlanIds = new Set();
    if (version >= 3) {
      check(Array.isArray(state.courseLearningPlans) && state.courseLearningPlans.length <= 10000, '课程学习计划数组无效或过大');
      for (const plan of state.courseLearningPlans) {
        validateCoursePlan(plan); register(plan.id); planIds.add(plan.id);
        const key = plan.courseId + '/' + plan.date;
        check(!planKeys.has(key), '同一课程同一日期的学习计划重复'); planKeys.add(key);
      }
    }
    for (const task of state.tasks) {
      const taskFields = ['id', 'title', 'category', 'date', 'originalDate', 'history', 'estimatedMinutes', 'priority', 'status', 'notes', 'evidence', 'createdAt', 'completedAt', 'statusHistory'];
      if (version >= 3) taskFields.push('coursePlanId');
      exact(task, taskFields, '任务');
      register(task.id); taskIds.add(task.id); str(task.title, 300, '任务名称', true); check(categoryKeys.includes(task.category), '任务分类无效');
      if (version >= 3 && task.coursePlanId !== null) {
        check(planIds.has(task.coursePlanId), '任务关联的课程学习计划不存在');
        check(!taskPlanIds.has(task.coursePlanId), '同一课程学习计划不能重复关联课后任务'); taskPlanIds.add(task.coursePlanId);
      }
      date(task.date); date(task.originalDate); number(task.estimatedMinutes, 0, 10080, '预计耗时'); check(['high', 'medium', 'low'].includes(task.priority), '优先级无效');
      check(STATUSES.includes(task.status), '任务状态无效'); str(task.notes, 20000, '任务备注'); str(task.evidence, 20000, '完成证据'); timestamp(task.createdAt);
      check(Array.isArray(task.history) && task.history.length <= 10000, '延期历史无效');
      let lastDate = task.originalDate, lastTime = Date.parse(task.createdAt);
      for (const h of task.history) {
        exact(h, ['from', 'to', 'at'], '日期变更'); date(h.from); date(h.to); timestamp(h.at);
        check(h.from === lastDate && h.from !== h.to && Date.parse(h.at) >= lastTime, '日期变更历史不连续'); lastDate = h.to; lastTime = Date.parse(h.at);
      }
      check(lastDate === task.date, '任务日期与历史不一致');
      check(Array.isArray(task.statusHistory) && task.statusHistory.length > 0 && task.statusHistory.length <= 10000, '状态历史无效');
      check(Date.parse(task.statusHistory[0].at) === Date.parse(task.createdAt), '初始状态时间与创建时间不一致');
      lastTime = Date.parse(task.createdAt);
      for (const h of task.statusHistory) { exact(h, ['status', 'at'], '状态变更'); check(STATUSES.includes(h.status), '状态历史无效'); timestamp(h.at); check(Date.parse(h.at) >= lastTime, '状态历史时间顺序无效'); lastTime = Date.parse(h.at); }
      const lastStatus = task.statusHistory[task.statusHistory.length - 1];
      check(lastStatus.status === task.status, '状态与历史不一致');
      if (task.status === 'done') { timestamp(task.completedAt); check(Date.parse(task.completedAt) === Date.parse(lastStatus.at), '完成时间与历史不一致'); }
      else check(task.completedAt === null, '未完成任务不能含完成时间');
    }
    const logs = new Map();
    for (const log of state.logs) {
      exact(log, ['id', 'date', 'category', 'minutes', 'taskId', 'evidence'], '投入记录'); register(log.id); logs.set(log.id, log);
      date(log.date); check(categoryKeys.includes(log.category), '投入分类无效'); number(log.minutes, 1, 1440, '投入分钟'); str(log.evidence, 20000, '投入成果');
      check(log.taskId === null || taskIds.has(log.taskId), '投入关联的任务不存在');
    }
    const healthDates = new Set();
    for (const health of state.health) {
      exact(health, ['date', 'weight', 'trained'], '健康记录'); date(health.date); check(!healthDates.has(health.date), '健康记录日期重复'); healthDates.add(health.date);
      if (health.weight !== null) number(health.weight, 0.1, 1000, '体重', false);
      check(typeof health.trained === 'boolean', '训练状态无效');
    }
    object(state.mainByDate, null, [], '每日主任务');
    for (const [key, value] of Object.entries(state.mainByDate)) { date(key); check(taskIds.has(value), '主任务引用不存在'); }
    const attendanceKeys = new Set(), attendanceLogs = new Set();
    for (const entry of state.attendance) {
      exact(entry, ['date', 'courseId', 'plannedMinutes', 'attended', 'logId'], '旁听记录'); date(entry.date); id(entry.courseId); number(entry.plannedMinutes, 0, 1440, '旁听预留分钟');
      check(typeof entry.attended === 'boolean', '旁听状态无效'); const key = entry.date + '/' + entry.courseId; check(!attendanceKeys.has(key), '旁听场次重复'); attendanceKeys.add(key);
      if (entry.attended) { check(logs.has(entry.logId), '旁听投入引用不存在'); const log = logs.get(entry.logId); check(log.category === 'power' && log.date === entry.date, '旁听投入日期或分类不一致'); check(!attendanceLogs.has(entry.logId), '同一投入不能属于两次旁听'); attendanceLogs.add(entry.logId); }
      else check(entry.logId === null, '未参加旁听不能关联投入');
    }
    object(state.reviews, null, [], '周总结');
    for (const [key, value] of Object.entries(state.reviews)) {
      check(weekStart(key) === key, '周总结必须以周一为键'); exact(value, ['monday', 'cutoffISO', 'text', 'reflection', 'stats'], '总结快照'); check(value.monday === key, '总结日期不一致'); timestamp(value.cutoffISO); str(value.text, 200000, '总结文本'); reflection(value.reflection);
      exact(value.stats, ['budgetMinutes', 'allocatedMinutes', 'goals', 'actual', 'taskCount', 'completedCount', 'weightAverage', 'weightCount', 'trainingDays', 'attendanceCount'], '总结事实');
      for (const field of ['budgetMinutes', 'allocatedMinutes', 'taskCount', 'completedCount', 'attendanceCount']) number(value.stats[field], 0, 100000000, field);
      for (const field of ['weightCount', 'trainingDays']) number(value.stats[field], 0, 7, field);
      check(value.stats.completedCount <= value.stats.taskCount, '总结完成数超出总数');
      // Version 1 review snapshots stay verbatim. Version 2 live plans always have
      // eight categories, while saved reviews may retain the original seven.
      const snapshotKeys = version === 1 || !own(value.stats.goals, 'agent') ? LEGACY_KEYS : KEYS;
      goalValues(value.stats.goals, false, snapshotKeys); goalValues(value.stats.actual, true, snapshotKeys);
      if (value.stats.weightAverage !== null) number(value.stats.weightAverage, 0.1, 1000, '总结平均体重', false);
      check((value.stats.weightCount === 0) === (value.stats.weightAverage === null), '总结体重样本不一致');
    }
    return true;
  }
  function statusAt(task, cutoff) {
    const events = task.statusHistory.filter(h => Date.parse(h.at) <= cutoff);
    return events.length ? events[events.length - 1].status : null;
  }
  function weightWindow(state, startDate, endDate) {
    const values = state.health.filter(h => h.date >= startDate && h.date <= endDate && h.weight !== null).map(h => h.weight);
    return { startDate, endDate, average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, count: values.length };
  }
  function healthStats(state, endDate = today()) {
    date(endDate); const recent = weightWindow(state, addDays(endDate, -6), endDate), previous = weightWindow(state, addDays(endDate, -13), addDays(endDate, -7));
    const records = state.health.filter(h => h.date <= endDate && h.weight !== null).sort((a, b) => b.date.localeCompare(a.date));
    return { current: records.length ? { date: records[0].date, weight: records[0].weight } : null, startWeight: 158, targetWeight: 128, recent, previous, change: recent.average !== null && previous.average !== null ? recent.average - previous.average : null };
  }
  function taskMinutes(state, taskId) { return state.logs.filter(log => log.taskId === taskId).reduce((total, log) => total + log.minutes, 0); }
  function focusTasks(state, value = today()) {
    date(value); const selected = state.tasks.find(task => task.id === state.mainByDate[value]) || null;
    let main = null;
    if (selected && selected.date === value) main = selected;
    else if (selected && statusAt(selected, new Date(value + 'T23:59:59.999').getTime()) === 'done') main = { ...selected, status: 'done' };
    const secondary = state.tasks.filter(task => task.date === value && task.status !== 'done' && task.priority === 'high' && (!main || task.id !== main.id)).slice(0, 2);
    return { main, secondary };
  }
  function progressValue(target, actual) {
    return { target, actual, percent: target > 0 ? actual / target * 100 : null, label: target === 0 ? (actual > 0 ? '计划外投入' : '未设目标/已暂停') : (actual > target ? '超出计划' : '已记录') };
  }
  function weekStats(state, value, cutoffISO) {
    const monday = weekStart(value), endDate = addDays(monday, 6), plan = getWeek(state, monday);
    const cutoff = cutoffISO ? Date.parse(timestamp(cutoffISO)) : Infinity, lastDate = cutoffISO ? today(cutoffISO) : '9999-12-31';
    const inWeek = d => d >= monday && d <= endDate;
    const minutes = zeroTotals();
    for (const log of state.logs) if (inWeek(log.date) && log.date <= lastDate) minutes[log.category] += log.minutes;
    const trainingDays = state.health.filter(h => inWeek(h.date) && h.date <= lastDate && h.trained).length;
    const actual = { ...minutes, fitness: trainingDays };
    const tasks = state.tasks.filter(task => Date.parse(task.createdAt) <= cutoff && (inWeek(task.originalDate) || task.history.some(h => Date.parse(h.at) <= cutoff && (inWeek(h.from) || inWeek(h.to)))));
    const incompleteTasks = tasks.filter(task => statusAt(task, cutoff) !== 'done');
    const postponedTasks = tasks.filter(task => task.history.some(h => Date.parse(h.at) <= cutoff && inWeek(h.from) && !inWeek(h.to)));
    const plannedAttendanceMinutes = state.attendance.filter(a => inWeek(a.date)).reduce((sum, a) => sum + a.plannedMinutes, 0);
    const attendanceOverGoalMinutes = Math.max(0, plannedAttendanceMinutes - plan.goals.power);
    const allocatedMinutes = KEYS.filter(key => key !== 'fitness').reduce((sum, key) => sum + plan.goals[key], plan.fitnessMinutes + attendanceOverGoalMinutes);
    const weight = weightWindow(state, monday, lastDate < endDate ? lastDate : endDate);
    const completedCount = tasks.length - incompleteTasks.length;
    const attendanceCount = state.attendance.filter(a => inWeek(a.date) && a.date <= lastDate && a.attended).length;
    return { monday, endDate, ...plan, allocatedMinutes, remainingMinutes: plan.budgetMinutes - allocatedMinutes, plannedAttendanceMinutes, attendanceOverGoalMinutes, totalMinutes: Object.values(minutes).reduce((a, b) => a + b, 0), actual, totals: actual, minutes, progress: Object.fromEntries(KEYS.map(key => [key, progressValue(plan.goals[key], actual[key])])), taskCount: tasks.length, taskTotal: tasks.length, completedCount, taskDone: completedCount, completionPercent: tasks.length ? completedCount / tasks.length * 100 : null, tasks, incompleteTasks, unfinished: incompleteTasks, postponedTasks, deferred: postponedTasks, weight, trainingDays, attendanceCount };
  }
  function getCoursePlan(state, courseId, value) {
    id(courseId); date(value);
    const plan = state.courseLearningPlans.find(item => item.courseId === courseId && item.date === value);
    return plan ? clone(plan) : null;
  }
  function courseLearningStats(state, value, cutoffISO) {
    const monday = weekStart(value), endDate = addDays(monday, 6), cutoffDate = cutoffISO ? today(timestamp(cutoffISO)) : today();
    const records = state.courseLearningPlans.filter(plan => plan.date >= monday && plan.date <= endDate && plan.date <= cutoffDate &&
      (plan.levelReached !== 'unreviewed' || plan.evidence.length > 0 || plan.reflection.trim() || plan.unresolvedProblem.trim()));
    return {
      reviewedCount: records.length,
      minimumCount: records.filter(plan => plan.levelReached === 'minimum').length,
      standardCount: records.filter(plan => plan.levelReached === 'standard').length,
      stretchCount: records.filter(plan => plan.levelReached === 'stretch').length,
      blockedCount: records.filter(plan => plan.levelReached === 'blocked' || plan.evidence.includes('stuck') || plan.unresolvedProblem.trim()).length,
      records: clone(records).sort((a, b) => a.date.localeCompare(b.date) || a.courseId.localeCompare(b.courseId))
    };
  }
  function courseLearningText(state, planId) {
    id(planId); const plan = state.courseLearningPlans.find(item => item.id === planId); check(plan, '找不到课程学习计划');
    const course = courseForPlan(plan), weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    const sections = [
      '【课程】', course.name + (course.optional ? '（可选旁听）' : ''), '教师：' + course.teacher + '；教室：' + course.room,
      '', '【教学周】', '第' + plan.week + '周', '', '【本节时间】', plan.date + ' ' + weekdays[course.day - 1] + ' ' + (course.slot * 2 - 1) + '–' + course.slot * 2 + '节',
      '', '【本节主题】', plan.topic || '尚未填写', '', '【课前问题】', ...(plan.preQuestions.length ? plan.preQuestions.map(item => '- ' + item) : ['尚未填写']),
      '', '【保底线】', ...(plan.minimumGoals.length ? plan.minimumGoals.map(item => '- ' + item) : ['尚未填写']),
      '', '【达标线】', ...(plan.standardGoals.length ? plan.standardGoals.map(item => '- ' + item) : ['尚未填写']),
      '', '【进阶线（可选）】', ...(plan.stretchGoals.length ? plan.stretchGoals.map(item => '- ' + item) : ['尚未填写']),
      '', '【本节实际学习成果】', plan.reflection || '尚未记录', '', '【学习证据】', ...(plan.evidence.length ? plan.evidence.map(item => '- ' + COURSE_EVIDENCE[item]) : ['尚未记录']),
      '', '【本节最大问题 / 卡点】', plan.unresolvedProblem || '尚未记录', '', '【本节自评】', COURSE_LEVELS[plan.levelReached],
      '', '请根据本次学习记录，帮我复盘实际完成的内容、核对学习证据，优先解决仍存在的卡点，并给出下一步行动。主题或教材信息不足时请先询问，不猜测知识点，也不要把已填计划当作已经完成的成果。',
      '进阶目标可选；学习证据与实际投入时间分开记录，不能据时长推断掌握程度。'
    ];
    return sections.join('\n');
  }
  function getTask(state, taskId) { const task = state.tasks.find(t => t.id === taskId); check(task, '找不到任务'); return task; }
  function getLog(state, logId) { const log = state.logs.find(l => l.id === logId); check(log, '找不到投入记录'); return log; }
  function changeStatus(task, status, now) { check(STATUSES.includes(status), '任务状态无效'); if (task.status !== status) { task.status = status; task.statusHistory.push({ status, at: now }); task.completedAt = status === 'done' ? now : null; } }
  function changeDate(task, nextDate, now) { date(nextDate); if (task.date !== nextDate) { task.history.push({ from: task.date, to: nextDate, at: now }); task.date = nextDate; } }
  function deleteLog(state, logId) {
    getLog(state, logId); state.logs = state.logs.filter(l => l.id !== logId);
    for (const a of state.attendance) if (a.logId === logId) { a.logId = null; a.attended = false; }
  }
  function mutate(state, action, payload, nowISO) {
    const p = payload || {}, now = timestamp(nowISO || new Date().toISOString());
    object(p, null, [], '操作参数');
    if (action === 'settings') { object(p, ['direction', 'focus', 'defer', 'hideStocks'], [], '设置'); Object.assign(state.settings, p); }
    else if (action === 'week' || action === 'week:applyNext') {
      exact(p, ['monday', 'budgetMinutes', 'goals', 'fitnessMinutes'], '目标参数'); const key = action === 'week:applyNext' ? addDays(weekStart(p.monday), 7) : weekStart(p.monday);
      state.weeks[key] = { budgetMinutes: p.budgetMinutes, goals: clone(p.goals), fitnessMinutes: p.fitnessMinutes };
    } else if (action === 'coursePlan:save') {
      object(p, COURSE_PLAN_FIELDS, COURSE_PLAN_FIELDS.filter(field => field !== 'id'), '保存课程学习计划');
      const existing = p.id ? state.courseLearningPlans.find(plan => plan.id === p.id) : state.courseLearningPlans.find(plan => plan.courseId === p.courseId && plan.date === p.date);
      const next = migrationClone({ ...p, id: p.id || (existing ? existing.id : makeId('course')) }); validateCoursePlan(next);
      if (existing) {
        check(existing.courseId === next.courseId && existing.date === next.date, '已有课程计划不能移到另一堂课');
        state.courseLearningPlans[state.courseLearningPlans.indexOf(existing)] = next;
      } else state.courseLearningPlans.push(next);
    } else if (action === 'task:add') {
      object(p, ['id', 'title', 'category', 'date', 'estimatedMinutes', 'priority', 'status', 'notes', 'evidence', 'coursePlanId'], ['title', 'category', 'date'], '新任务');
      if (p.coursePlanId !== undefined && p.coursePlanId !== null) {
        check(state.courseLearningPlans.some(plan => plan.id === p.coursePlanId), '任务关联的课程学习计划不存在');
        if (state.tasks.some(task => task.coursePlanId === p.coursePlanId)) { validateState(state); return state; }
      }
      const status = p.status || 'todo'; state.tasks.push({ id: p.id || makeId('task'), title: p.title.trim(), category: p.category, date: p.date, originalDate: p.date, history: [], estimatedMinutes: p.estimatedMinutes ?? 0, priority: p.priority || 'medium', status, notes: p.notes || '', evidence: p.evidence || '', createdAt: now, completedAt: status === 'done' ? now : null, statusHistory: [{ status, at: now }], coursePlanId: p.coursePlanId ?? null });
    } else if (action === 'task:edit' || action === 'task:update') {
      object(p, ['id', 'title', 'category', 'date', 'estimatedMinutes', 'priority', 'status', 'notes', 'evidence', 'coursePlanId'], ['id'], '编辑任务'); const task = getTask(state, p.id);
      if (own(p, 'coursePlanId')) check(p.coursePlanId === task.coursePlanId, '编辑任务时不能改绑或解除课程学习计划');
      for (const key of ['title', 'category', 'estimatedMinutes', 'priority', 'notes', 'evidence']) if (own(p, key)) task[key] = key === 'title' ? p[key].trim() : p[key];
      if (own(p, 'date')) changeDate(task, p.date, now); if (own(p, 'status')) changeStatus(task, p.status, now);
    } else if (action === 'task:complete') { exact(p, ['id'], '完成任务'); changeStatus(getTask(state, p.id), 'done', now); }
    else if (action === 'task:postpone') { object(p, ['id', 'today'], ['id'], '延期任务'); changeDate(getTask(state, p.id), addDays(p.today || today(now), 1), now); }
    else if (action === 'task:delete') {
      object(p, ['id', 'deleteLogs'], ['id'], '删除任务'); getTask(state, p.id); if (own(p, 'deleteLogs')) check(typeof p.deleteLogs === 'boolean', '删除投入选项无效');
      state.tasks = state.tasks.filter(t => t.id !== p.id);
      for (const log of [...state.logs]) if (log.taskId === p.id) { if (p.deleteLogs) deleteLog(state, log.id); else log.taskId = null; }
      for (const key of Object.keys(state.mainByDate)) if (state.mainByDate[key] === p.id) delete state.mainByDate[key];
    } else if (action === 'main:set') {
      exact(p, ['date', 'taskId'], '选择主任务'); date(p.date);
      if (p.taskId === null) delete state.mainByDate[p.date];
      else { const task = getTask(state, p.taskId); check(task.date === p.date, '只能选择安排在该日的任务为主任务'); state.mainByDate[p.date] = task.id; }
    } else if (action === 'log:add') {
      object(p, ['id', 'date', 'category', 'minutes', 'taskId', 'evidence'], ['date', 'category', 'minutes'], '新增投入'); state.logs.push({ id: p.id || makeId('log'), date: p.date, category: p.category, minutes: p.minutes, taskId: p.taskId ?? null, evidence: p.evidence || '' });
    } else if (action === 'log:edit') {
      object(p, ['id', 'date', 'category', 'minutes', 'taskId', 'evidence'], ['id'], '编辑投入'); const log = getLog(state, p.id);
      for (const key of ['date', 'category', 'minutes', 'taskId', 'evidence']) if (own(p, key)) log[key] = p[key];
    } else if (action === 'log:delete') { exact(p, ['id'], '删除投入'); deleteLog(state, p.id); }
    else if (action === 'health:set') { exact(p, ['date', 'weight', 'trained'], '健康记录'); const found = state.health.find(h => h.date === p.date); if (found) Object.assign(found, p); else state.health.push(clone(p)); }
    else if (action === 'health:delete') { exact(p, ['date'], '删除健康记录'); state.health = state.health.filter(h => h.date !== p.date); }
    else if (action === 'attendance:plan' || action === 'attendance:attend' || action === 'attendance:cancel') {
      const allowed = action === 'attendance:plan' ? ['date', 'courseId', 'plannedMinutes'] : action === 'attendance:attend' ? ['date', 'courseId', 'minutes', 'evidence'] : ['date', 'courseId', 'deleteLog'];
      object(p, allowed, ['date', 'courseId'], '旁听操作'); date(p.date); id(p.courseId); let entry = state.attendance.find(a => a.date === p.date && a.courseId === p.courseId);
      if (action === 'attendance:cancel') {
        if (own(p, 'deleteLog')) check(typeof p.deleteLog === 'boolean', '删除旁听投入选项无效');
        if (entry) { if (entry.logId && p.deleteLog) deleteLog(state, entry.logId); if (entry.attended) entry.plannedMinutes = 0; else state.attendance = state.attendance.filter(a => a !== entry); }
      } else {
        if (!entry) { entry = { date: p.date, courseId: p.courseId, plannedMinutes: 0, attended: false, logId: null }; state.attendance.push(entry); }
        if (action === 'attendance:plan') entry.plannedMinutes = p.plannedMinutes;
        else {
          number(p.minutes, 1, 1440, '旁听实际分钟');
          if (entry.logId) { const log = getLog(state, entry.logId); log.minutes = p.minutes; if (own(p, 'evidence')) log.evidence = p.evidence; }
          else { entry.logId = makeId('log'); state.logs.push({ id: entry.logId, date: p.date, category: 'power', minutes: p.minutes, taskId: null, evidence: p.evidence || '' }); }
          entry.attended = true;
        }
      }
    } else if (action === 'review:save') {
      object(p, ['monday', 'text', 'reflection'], ['monday', 'text'], '保存总结'); const monday = weekStart(p.monday), stats = weekStats(state, monday, now);
      state.reviews[monday] = { monday, cutoffISO: now, text: p.text, reflection: p.reflection || { progress: '', adjustments: '', outcomes: '' }, stats: { budgetMinutes: stats.budgetMinutes, allocatedMinutes: stats.allocatedMinutes, goals: clone(stats.goals), actual: clone(stats.actual), taskCount: stats.taskCount, completedCount: stats.completedCount, weightAverage: stats.weight.average, weightCount: stats.weight.count, trainingDays: stats.trainingDays, attendanceCount: stats.attendanceCount } };
    } else fail('不支持的操作：' + action);
    validateState(state); return state;
  }
  function formatHours(minutes) { return String(Math.round(minutes / 60 * 100) / 100); }
  function summaryText(state, value, options) {
    const o = options || {}, cutoffISO = o.cutoffISO || new Date().toISOString(), stats = weekStats(state, value, cutoffISO);
    const week = teachingWeek(stats.monday), heading = week < 1 ? '学期前周总结' : week > 20 ? '学期后周总结' : '第' + week + '教学周学习总结';
    const lines = [heading, '统计区间：' + stats.monday + ' 至 ' + stats.endDate, '统计截止：' + cutoffISO, '', '本周投入：'];
    for (const c of CATEGORIES) lines.push(c.label + '：' + (c.id === 'fitness' ? stats.actual[c.id] + '/' + stats.goals[c.id] + '天' : formatHours(stats.actual[c.id]) + '/' + formatHours(stats.goals[c.id]) + 'h') + (stats.goals[c.id] === 0 ? '（' + stats.progress[c.id].label + '）' : ''));
    lines.push('自由时间预算：' + formatHours(stats.budgetMinutes) + 'h；已分配：' + formatHours(stats.allocatedMinutes) + 'h（含健身预算；旁听在电力目标内预留，超过目标部分另计）', '电力系统分析旁听：参加' + stats.attendanceCount + '次', '体重本周均值：' + (stats.weight.average === null ? '暂无记录' : stats.weight.average.toFixed(1) + '斤') + '（记录' + stats.weight.count + '/7天）', '完成任务：' + stats.completedCount + '/' + stats.taskCount, '任务口径：原计划或改期历史曾安排在本周的任务按 ID 去重，按截止时点状态统计。', '', '未完成任务：');
    lines.push(...(stats.incompleteTasks.length ? stats.incompleteTasks.map(t => '- ' + t.title + '（当前安排：' + t.date + '）') : ['无']));
    lines.push('', '跨周延期：', ...(stats.postponedTasks.length ? stats.postponedTasks.map(t => '- ' + t.title + '（原计划：' + t.originalDate + '；当前安排：' + t.date + '）') : ['无']));
    lines.push('', '本周学习证据/未解决问题：');
    const evidence = state.logs.filter(l => l.date >= stats.monday && l.date <= stats.endDate && l.date <= today(cutoffISO) && l.evidence.trim()).map(l => '- ' + l.date + ' ' + l.evidence);
    for (const t of stats.tasks) if (t.evidence.trim()) evidence.push('- ' + t.title + '：' + t.evidence);
    lines.push(...(evidence.length ? evidence : ['暂无记录']), '', '下周正式课程、可选旁听及时间待定提示：', o.nextCoursesText || '请查看下周课表；未提供课程文本。');
    const r = o.reflection || { progress: '', adjustments: '', outcomes: '' };
    lines.push('', '本周取得的真实进展：', r.progress || '待填写', '', '继续/减少/增加的投入：', r.adjustments || '待填写', '', '下周最重要的三个结果：', r.outcomes || '待填写');
    const courseStats = courseLearningStats(state, stats.monday, cutoffISO);
    lines.push('', '本周课程学习复盘：', '已复盘课程：' + courseStats.reviewedCount + '；达到保底线：' + courseStats.minimumCount + '；达到达标线：' + courseStats.standardCount + '；达到进阶线：' + courseStats.stretchCount + '；存在卡点：' + courseStats.blockedCount,
      '口径：按课程日期截至' + today(cutoffISO) + '；仅填写计划不算复盘，三档按明确自评分别统计，卡点独立记录；固定课时不加入自主学习分钟。');
    if (!courseStats.records.length) lines.push('本周暂无课程学习复盘记录。');
    for (const plan of courseStats.records) {
      const course = courseForPlan(plan);
      lines.push('- ' + plan.date + ' ' + course.name + '（' + (course.slot * 2 - 1) + '–' + course.slot * 2 + '节）：' + COURSE_LEVELS[plan.levelReached],
        '  本节主题：' + (plan.topic || '尚未填写'), '  实际成果：' + (plan.reflection || '尚未记录'), '  学习证据：' + (plan.evidence.map(item => COURSE_EVIDENCE[item]).join('；') || '尚未记录'),
        '  卡点：' + (plan.unresolvedProblem || (plan.evidence.includes('stuck') || plan.levelReached === 'blocked' ? '已标记卡点，尚未填写具体问题' : '尚未记录')));
    }
    return lines.join('\n');
  }
  function migrationClone(value, ancestors = new Set(), depth = 0) {
    // JSON.stringify alone would silently turn NaN/Infinity into null and omit
    // undefined fields. Reject non-JSON values before making a migration copy.
    check(depth <= 100, '数据嵌套过深');
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') { check(Number.isFinite(value), '数据包含非有限数值'); return value; }
    check(typeof value === 'object' && value !== null, '数据包含不支持的值');
    check(!ancestors.has(value), '数据包含循环引用');
    check(Object.getOwnPropertySymbols(value).length === 0, '数据包含不支持的符号字段');
    ancestors.add(value);
    let result;
    if (Array.isArray(value)) {
      check(Object.getPrototypeOf(value) === Array.prototype && value.length <= 100000, '数组格式无效或过大');
      check(Object.getOwnPropertyNames(value).length === value.length + 1, '数组包含缺失项或额外字段');
      result = value.map(item => migrationClone(item, ancestors, depth + 1));
    } else {
      object(value, null, [], '升级数据');
      check(Object.getOwnPropertyNames(value).length === Object.keys(value).length, '数据包含不可枚举字段');
      result = {};
      for (const key of Object.keys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        check(descriptor && own(descriptor, 'value'), '数据包含不支持的访问器');
        result[key] = migrationClone(descriptor.value, ancestors, depth + 1);
      }
    }
    ancestors.delete(value);
    return result;
  }
  function normalizeGoalAliases(goals) {
    if (!goals || typeof goals !== 'object' || Array.isArray(goals)) return;
    const present = STOCK_ALIASES.filter(key => own(goals, key));
    check(present.length <= 1, '分类键冲突：stocks、股票/理财、财务/投资不能同时存在');
    if (present.length === 1 && present[0] !== 'stocks') {
      goals.stocks = goals[present[0]];
      delete goals[present[0]];
    }
  }
  function normalizeStockAliases(state) {
    for (const collection of [state.tasks, state.logs]) if (Array.isArray(collection)) {
      for (const entry of collection) if (entry && typeof entry === 'object' && STOCK_ALIASES.includes(entry.category)) entry.category = 'stocks';
    }
    if (state.weeks && typeof state.weeks === 'object') for (const week of Object.values(state.weeks)) {
      if (week && typeof week === 'object') normalizeGoalAliases(week.goals);
    }
    if (state.reviews && typeof state.reviews === 'object') for (const review of Object.values(state.reviews)) {
      if (review && typeof review === 'object' && review.stats && typeof review.stats === 'object') {
        normalizeGoalAliases(review.stats.goals); normalizeGoalAliases(review.stats.actual);
      }
    }
  }
  function upgradeState(raw) {
    const candidate = migrationClone(raw);
    object(candidate, null, ['schemaVersion'], '升级数据');
    check([1, 2, 3].includes(candidate.schemaVersion), '不支持的 schemaVersion');
    normalizeStockAliases(candidate);
    if (candidate.schemaVersion === 1) {
      // Validate the complete original shape before adding the new category;
      // absent original fields and invalid references are never repaired silently.
      validateStateShape(candidate, 1);
      for (const week of Object.values(candidate.weeks)) week.goals.agent = 0;
      candidate.schemaVersion = 2;
    }
    if (candidate.schemaVersion === 2) {
      validateStateShape(candidate, 2);
      candidate.courseLearningPlans = [];
      for (const task of candidate.tasks) task.coursePlanId = null;
      candidate.schemaVersion = 3;
    }
    validateState(candidate);
    return candidate;
  }
  function exportData(state, nowISO) { validateState(state); return JSON.stringify({ schemaVersion: 3, exportedAt: timestamp(nowISO || new Date().toISOString()), data: state }, null, 2); }
  function parseImport(text) {
    str(text, 20000000, '导入文件', true); let envelope;
    try { envelope = JSON.parse(text); } catch (_) { fail('JSON 已损坏，未导入任何数据'); }
    exact(envelope, ['schemaVersion', 'exportedAt', 'data'], '导入文件'); check([1, 2, 3].includes(envelope.schemaVersion), '不支持的导入版本'); timestamp(envelope.exportedAt);
    check(envelope.data && envelope.data.schemaVersion === envelope.schemaVersion, '导出文件版本与数据版本不一致');
    const state = upgradeState(envelope.data);
    return { state, exportedAt: envelope.exportedAt, counts: { tasks: state.tasks.length, logs: state.logs.length, health: state.health.length, weeks: Object.keys(state.weeks).length, attendance: state.attendance.length, reviews: Object.keys(state.reviews).length, courseLearningPlans: state.courseLearningPlans.length } };
  }
  return { CATEGORIES, newState, today, addDays, weekStart, weekDates, teachingWeek, remainingDays, getWeek, validateState, upgradeState, mutate, weekStats, healthStats, taskMinutes, focusTasks, summaryText, exportData, parseImport, formatHours, getCoursePlan, courseLearningText, courseLearningStats };
});
