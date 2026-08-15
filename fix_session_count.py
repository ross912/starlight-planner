#!/usr/bin/env python3
"""修改健身活动记录计数逻辑：同一天多条力量训练合并为 1 次，其他类型每条各算 1 次。"""
import sys

path = 'server/index.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

replacements = []

# 1. todayCount — 当天：非力量 COUNT + 力量 DISTINCT date (0或1)
old1 = "todayCount: db.prepare('SELECT COUNT(*) AS c FROM workouts WHERE user_id = ? AND date = ?').get(uid, fmtDate(new Date())).c || 0,"
new1 = ("todayCount: db.prepare(`SELECT ((SELECT COUNT(*) FROM workouts WHERE user_id = ? AND type != 'strength' AND date = ?) "
        "+ (SELECT COUNT(DISTINCT date) FROM workouts WHERE user_id = ? AND type = 'strength' AND date = ?)) AS c`)"
        ".get(uid, fmtDate(new Date()), uid, fmtDate(new Date())).c || 0,")
replacements.append(('todayCount', old1, new1))

# 2. monthSessions — 本月
old2 = "monthSessions: db.prepare('SELECT COUNT(*) AS c FROM workouts WHERE user_id = ? AND date LIKE ?').get(uid, `${thisMonth}-%`).c || 0,"
new2 = ("monthSessions: db.prepare(`SELECT ((SELECT COUNT(*) FROM workouts WHERE user_id = ? AND type != 'strength' AND date LIKE ?) "
        "+ (SELECT COUNT(DISTINCT date) FROM workouts WHERE user_id = ? AND type = 'strength' AND date LIKE ?)) AS c`)"
        ".get(uid, `${thisMonth}-%`, uid, `${thisMonth}-%`).c || 0,")
replacements.append(('monthSessions', old2, new2))

# 3. totalSessions — 全部
old3 = "totalSessions: db.prepare('SELECT COUNT(*) AS c FROM workouts WHERE user_id = ?').get(uid).c || 0,"
new3 = ("totalSessions: db.prepare(`SELECT ((SELECT COUNT(*) FROM workouts WHERE user_id = ? AND type != 'strength') "
        "+ (SELECT COUNT(DISTINCT date) FROM workouts WHERE user_id = ? AND type = 'strength')) AS c`)"
        ".get(uid, uid).c || 0,")
replacements.append(('totalSessions', old3, new3))

# 4. trend 每日 count
old4 = "arr.push({ date: key, count: db.prepare('SELECT COUNT(*) AS c FROM workouts WHERE user_id = ? AND date = ?').get(uid, key).c || 0 })"
new4 = ("arr.push({ date: key, count: db.prepare(`SELECT ((SELECT COUNT(*) FROM workouts WHERE user_id = ? AND type != 'strength' AND date = ?) "
        "+ (SELECT COUNT(DISTINCT date) FROM workouts WHERE user_id = ? AND type = 'strength' AND date = ?)) AS c`)"
        ".get(uid, key, uid, key).c || 0 })")
replacements.append(('trend count', old4, new4))

for name, old, new in replacements:
    if old not in content:
        print(f'ERROR: [{name}] 原文未找到，跳过')
        sys.exit(1)
    if content.count(old) > 1:
        print(f'ERROR: [{name}] 原文匹配多处，需更精确匹配')
        sys.exit(1)
    content = content.replace(old, new)
    print(f'OK: [{name}] 已替换')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Done — 写入完成')
