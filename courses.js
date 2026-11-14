(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.TGCourses = api;
}(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // Source: the user's 2026-2027-1 PDF timetable, visually checked on both pages.
  // Section 7 of the merged baseline corrects the Thursday microcomputer class.
  // Slots are timetable periods, not clock times: a complete verified bell schedule is unavailable.
  var weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  var periods = ['1–2节', '3–4节', '5–6节', '7–8节', '9–10节'];

  function range(first, last) {
    var result = [];
    for (var week = first; week <= last; week += 1) result.push(week);
    return result;
  }

  function course(id, name, teacher, room, day, slot, weeks, optional, notice, metadata) {
    return Object.freeze(Object.assign({
      id: id, name: name, teacher: teacher, room: room, day: day,
      slot: slot, weeks: Object.freeze(weeks), optional: Boolean(optional), notice: notice || ''
    }, metadata || {}));
  }

  var microLab = Object.freeze({ type: 'lab', displayName: '🧪 单片机实验', formalName: '微型计算机原理及接口技术实验' });
  var microAssessment = Object.freeze({ type: 'assessment', displayName: '🔴 单片机实验考核', formalName: '微型计算机原理及接口技术实验' });
  var cadLab = Object.freeze({ type: 'lab', displayName: '🧪 电子电路CAD实验' });
  var personalProfile = Object.freeze({ name: '范子特', className: '测控241', group: 1 });
  var groupLabNotice = '本人参加第一组的本次实验；如与理论课重叠，本次上实验课，理论课不上。课程正式名称、教师和地点待确认。';

  var courses = Object.freeze([
    // User-supplied laboratory schedule, confirmed 2026-09-11. Teacher/location not supplied.
    course('micro-lab-tue', '微型计算机原理及接口技术实验（单片机实验）', '待确认', '地点待确认', 2, 2, [8, 9, 10], false, '', microLab),
    course('micro-lab-wed', '微型计算机原理及接口技术实验（单片机实验）', '待确认', '地点待确认', 3, 3, [8, 9], false, '', microLab),
    course('micro-lab-thu', '微型计算机原理及接口技术实验（单片机实验）', '待确认', '地点待确认', 4, 2, [8, 9], false, '', microLab),
    course('micro-lab-fri-w8', '微型计算机原理及接口技术实验（单片机实验）', '待确认', '地点待确认', 5, 2, [8], false, '', microLab),
    course('micro-lab-fri-w9', '微型计算机原理及接口技术实验（单片机实验）', '待确认', '地点待确认', 5, 3, [9], false, '', microLab),
    course('micro-lab-assessment', '微型计算机原理及接口技术实验（单片机实验·考核）', '待确认', '地点待确认', 2, 2, [11], false, '考核可以带教材、实验指导书；实验指导书上可以记笔记。', microAssessment),
    // The former pending CAD event now has confirmed periods and room; its original teacher is retained.
    course('cad-lab-wed', '电子电路CAD实验', '张叶', '主教239', 3, 3, range(11, 16), false, '', cadLab),
    course('cad-lab-fri', '电子电路CAD实验', '张叶', '主教239', 5, 3, range(11, 16), false, '', cadLab),
    course('group-lab-1', '【分组实验｜课程名待确认】', '待确认', '待确认', 3, 3, [6], false, groupLabNotice, { type: 'lab', group: 1, displayName: '🧪 分组实验①｜课程名待确认' }),
    course('group-lab-2', '【分组实验｜课程名待确认】', '待确认', '待确认', 2, 2, [7], false, groupLabNotice, { type: 'lab', group: 1, displayName: '🧪 分组实验②｜课程名待确认' }),
    course('group-lab-3', '【分组实验｜课程名待确认】', '待确认', '待确认', 4, 2, [7], false, groupLabNotice, { type: 'lab', group: 1, displayName: '🧪 分组实验③｜课程名待确认' }),
    course('group-lab-4', '【分组实验｜课程名待确认】', '待确认', '待确认', 2, 4, [8], false, groupLabNotice, { type: 'lab', group: 1, displayName: '🧪 分组实验④｜课程名待确认' }),
    course('micro-mon', '微型计算机原理及接口技术', '门洪', '二东402', 1, 1, range(1, 11)),
    course('sensors-mon', '传感器原理及应用', '耿靖童', '二中520', 1, 2, range(5, 16)),
    course('thought-mon', '习近平新时代中国特色社会主义思想概论', '曲宏歌', '二东602', 1, 3, range(1, 16)),
    // Latest teacher notice: weeks 3–10; all other original course fields are unchanged.
    course('software-mon', '测控软件技术', '刘玉秋', '一教239', 1, 4, range(3, 10)),
    course('micro-tue', '微型计算机原理及接口技术', '门洪', '二东201', 2, 1, range(1, 11)),
    course('instruments-tue', '现代分析仪器及应用', '付娆', '二东201', 2, 2, range(1, 7)),
    course('network-tue', '计算机网络技术', '陈丹丹', '二东302', 2, 3, range(1, 6)),
    course('thermal-tue', '热力设备及辅机', '姚国家', '二东202', 2, 3, range(9, 16)),
    course('economy-tue', '电力经济与管理', '刘寅东', '二东203', 2, 4, range(3, 6)),
    course('errors-wed', '误差理论与数据分析', '杨汉瑞', '二东301', 3, 2, range(4, 11)),
    course('sensors-wed', '传感器原理及应用', '耿靖童', '二中221', 3, 4, range(5, 16)),
    course('software-wed', '测控软件技术', '刘玉秋', '一教239', 3, 5, range(3, 10)),
    course('micro-thu', '微型计算机原理及接口技术', '门洪', '二东202', 4, 1, range(1, 11)),
    course('economy-thu', '电力经济与管理', '刘寅东', '二东302', 4, 2, range(3, 6)),
    course('thermal-thu', '热力设备及辅机', '姚国家', '二东202', 4, 3, range(9, 16)),
    course('network-thu', '计算机网络技术', '陈丹丹', '二东302', 4, 4, range(1, 6)),
    course('thought-fri', '习近平新时代中国特色社会主义思想概论', '曲宏歌', '四教B212', 5, 2, [1, 3, 5, 7, 9, 11, 13, 15]),
    course('instruments-fri', '现代分析仪器及应用', '付娆', '二东202', 5, 3, range(1, 8)),
    course('errors-fri', '误差理论与数据分析', '杨汉瑞', '二东301', 5, 4, range(4, 11)),
    course('policy-fri', '形势与政策教育', '魏子青', '东阶10合', 5, 5, range(5, 8)),
    course('history-sat', '党史', '刘中华', '东阶3合', 6, 1, range(1, 5)),
    course('history-sun', '党史', '刘中华', '东阶3合', 7, 3, range(1, 5)),
    // Source: the friend's timetable screenshot; these are optional attendance opportunities.
    course('power-tue', '电力系统分析', '杨玉龙', '二中627', 2, 4, range(1, 12), true),
    course('power-thu', '电力系统分析', '杨玉龙', '二中627', 4, 3, range(1, 13), true)
  ]);

  // The four confirmed personal slots are derived from their course definitions
  // so their calendar exception records cannot drift from the actual lab schedule.
  var scheduleExceptions = Object.freeze(courses.filter(function (item) {
    return item.group === 1;
  }).map(function (item) {
    return Object.freeze({
      id: item.id, courseId: item.id, group: item.group, className: personalProfile.className,
      week: item.weeks[0], day: item.day, slot: item.slot, status: 'confirmed'
    });
  }));
  var pendingNotices = Object.freeze([Object.freeze({
    id: 'group-lab-details', status: 'pending',
    notice: '第一组四次实验的课程正式名称、教师和地点尚未提供；已确认的四次个人实验时间照常显示。'
  })]);

  var events = Object.freeze([
    Object.freeze({
      name: '电子工艺设计', weeks: Object.freeze([18]),
      notice: '教师：孙天一、张叶；第18周，具体日期、节次和地点待确认。'
    }),
    Object.freeze({
      name: '传感器原理及应用课程设计', weeks: Object.freeze([19, 20]),
      notice: '教师：耿靖童、杨汉瑞；第19–20周，具体日期、节次和地点待确认。'
    })
  ]);

  function validWeek(value) {
    var week = Number(value);
    return Number.isInteger(week) && week >= 1 && week <= 20 ? week : null;
  }

  function settings(config) {
    return {
      courses: config && config.courses || courses,
      personalProfile: config && config.personalProfile || personalProfile
    };
  }

  function sameSlot(a, b) { return a.day === b.day && a.slot === b.slot; }
  function bySlot(a, b) { return a.day - b.day || a.slot - b.slot; }
  function isTheory(item) { return !item.optional && (!item.type || item.type === 'theory'); }
  function isLab(item) { return !item.optional && (item.type === 'lab' || item.type === 'assessment'); }

  // Resolve each occurrence, preserving the original theory course and its saved plan ID.
  // An explicit config lets tests verify theory/lab rules with isolated fixtures.
  function resolveSchedule(value, config) {
    var week = validWeek(value);
    if (week === null) return [];
    var source = settings(config);
    var formal = source.courses.filter(function (item) {
      return !item.optional && item.weeks.indexOf(week) !== -1
        && (!item.group || item.group === source.personalProfile.group);
    });
    return formal.map(function (item) {
      var occupyingLabs = isTheory(item) ? formal.filter(function (other) { return isLab(other) && sameSlot(item, other); }) : [];
      var status = occupyingLabs.length ? 'occupied' : 'normal';
      return Object.assign({}, item, {
        attendanceStatus: status,
        statusLabel: status === 'occupied' ? '【被实验占用】' : '',
        attendanceNotice: status === 'occupied' ? '本时段上实验课，理论课不上；原理论课保留供查看学习记录。' : '',
        relatedCourseIds: occupyingLabs.map(function (entry) { return entry.id; })
      });
    }).sort(bySlot);
  }

  function forWeek(value, config) { return resolveSchedule(value, config); }
  function activeForWeek(value, config) {
    return forWeek(value, config).filter(function (item) { return item.attendanceStatus === 'normal'; });
  }
  function attendanceFor(courseId, value, config) {
    var item = forWeek(value, config).find(function (entry) { return entry.id === courseId; });
    return item ? {
      attendanceStatus: item.attendanceStatus, statusLabel: item.statusLabel,
      attendanceNotice: item.attendanceNotice, relatedCourseIds: item.relatedCourseIds.slice()
    } : null;
  }

  function forDay(week, value) {
    var day = Number(value);
    if (!Number.isInteger(day) || day < 1 || day > 7) return [];
    return forWeek(week).filter(function (item) { return item.day === day; });
  }

  function optionalForWeek(value, config) {
    var week = validWeek(value);
    if (week === null) return [];
    var formal = activeForWeek(week, config);
    return settings(config).courses.filter(function (item) {
      return item.optional && item.weeks.indexOf(week) !== -1;
    }).map(function (item) {
      var conflicts = formal.filter(function (other) {
        return item.day === other.day && item.slot === other.slot;
      });
      return Object.assign({}, item, {
        conflict: conflicts.length > 0,
        conflictNames: conflicts.map(function (other) { return other.name; }),
        conflictIds: conflicts.map(function (other) { return other.id; }),
        warning: ''
      });
    }).sort(bySlot);
  }

  function conflictEntry(week, a, b, category, reason) {
    return {
      week: week, day: a.day, slot: a.slot, courseIds: [a.id, b.id],
      courseNames: [a.name, b.name], category: category, reason: reason
    };
  }

  // Report every raw formal overlap before attendance rules, plus optional conflicts
  // against only the classes the student must actually attend that week.
  function conflictReport(config) {
    var report = { weeks: 20, resolved: [], remaining: [], optional: [] };
    var source = settings(config);
    for (var week = 1; week <= 20; week += 1) {
      var formal = forWeek(week, source);
      formal.forEach(function (a, index) {
        formal.slice(index + 1).forEach(function (b) {
          if (!sameSlot(a, b)) return;
          var category = a.attendanceStatus === 'normal' && b.attendanceStatus === 'normal' ? 'remaining' : 'resolved';
          report[category].push(conflictEntry(week, a, b, category,
            category === 'resolved' ? (a.statusLabel || b.statusLabel) : '同一教学周、星期、节次存在正式课程重叠。'));
        });
      });
      optionalForWeek(week, source).forEach(function (item) {
        formal.filter(function (other) { return other.attendanceStatus === 'normal' && sameSlot(item, other); }).forEach(function (other) {
          report.optional.push(conflictEntry(week, item, other, 'optional', '正式课程或实验优先，旁听可选。'));
        });
      });
    }
    return report;
  }

  function courseLine(item) {
    return weekdays[item.day - 1] + ' ' + periods[item.slot - 1] + ' ' + (item.displayName || item.name)
      + ' / ' + item.teacher + ' / ' + item.room + (item.statusLabel ? ' ' + item.statusLabel : '')
      + (item.notice ? '【' + item.notice + '】' : '');
  }

  // The parameter is the week to describe. A summary for week N calls weekText(N + 1).
  function weekText(value) {
    var week = validWeek(value);
    if (week === null) {
      if (Number(value) > 20) return '本学期已结束；第20周后无本学期课表安排。';
      if (Number(value) < 1) return '教学周尚未开始；可预览第1教学周课表。';
      return '请选择第1–20教学周。';
    }
    var lines = ['第' + week + '教学周课程', '正式课程：'];
    var formal = forWeek(week);
    if (formal.length) formal.forEach(function (item) { lines.push(courseLine(item)); });
    else lines.push('无固定节次课程；请同时查看下方实验及课程设计提醒。');
    lines.push('', '可选旁听（正式课程优先，未参加不计为未完成任务）：');
    var optional = optionalForWeek(week);
    if (!optional.length) lines.push('本周无电力系统分析旁听安排。');
    optional.forEach(function (item) {
      lines.push(courseLine(item) + (item.conflict
        ? '【与' + item.conflictNames.join('、') + '冲突，正式课优先】'
        : '【固定课表无冲突，可选旁听】'));
      if (item.warning) lines.push('提醒：' + item.warning);
    });
    lines.push('', '实验及课程设计提醒：');
    var activeEvents = events.filter(function (item) { return item.weeks.indexOf(week) !== -1; });
    if (!activeEvents.length) lines.push('课表未列出本周时段待定事件。');
    activeEvents.forEach(function (item) { lines.push(item.name + '：' + item.notice); });
    pendingNotices.forEach(function (item) { lines.push('【待确认】' + item.notice); });
    lines.push('仅按课表节次显示，真实完整作息时间尚未提供；临时调课以实际通知为准。');
    return lines.join('\n');
  }

  return Object.freeze({
    courses: courses, events: events, personalProfile: personalProfile,
    scheduleExceptions: scheduleExceptions, pendingNotices: pendingNotices,
    forWeek: forWeek, forDay: forDay, activeForWeek: activeForWeek,
    attendanceFor: attendanceFor, resolveSchedule: resolveSchedule,
    optionalForWeek: optionalForWeek, conflictReport: conflictReport, weekText: weekText
  });
}));
