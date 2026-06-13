#!/usr/bin/env python3
import sys
sys.path.insert(0, '/Users/haofuyang/Library/Python/3.9/lib/python/site-packages')

import numpy as np
np.random.seed(42)

import pandas as pd

# Create realistic engineering efficiency data
teams = ['前端团队', '后端团队', '数据团队', '移动端团队']
sprints = ['迭代1', '迭代2', '迭代3', '迭代4', '迭代5', '迭代6']

data = []
for team in teams:
    if team == '前端团队':
        base_plan, base_complete, base_defect, base_coverage, base_cycle = 20, 17, 5, 72, 10
    elif team == '后端团队':
        base_plan, base_complete, base_defect, base_coverage, base_cycle = 25, 23, 3, 85, 6
    elif team == '数据团队':
        base_plan, base_complete, base_defect, base_coverage, base_cycle = 15, 12, 7, 60, 15
    else:
        base_plan, base_complete, base_defect, base_coverage, base_cycle = 18, 16, 4, 78, 8

    for i, sprint in enumerate(sprints):
        trend = (i - 2.5) * 0.3
        plan = max(10, int(base_plan + np.random.normal(0, 3)))
        complete = max(8, min(plan, int(base_complete + trend + np.random.normal(0, 2))))
        defect = max(0, int(base_defect + np.random.normal(0, 1.5) - trend * 0.5))
        coverage = min(100, max(30, int(base_coverage + trend * 2 + np.random.normal(0, 5))))
        cycle = max(1, int(base_cycle - trend * 0.5 + np.random.normal(0, 2)))

        if team == '移动端团队' and sprint == '迭代4':
            defect = defect + 12

        if team == '后端团队' and sprint == '迭代5':
            cycle = cycle + 20

        data.append([team, sprint, plan, complete, defect, coverage, cycle])

df = pd.DataFrame(data, columns=['团队', '迭代', '需求计划数', '需求完成数', '缺陷数', '代码覆盖率(%)', '平均交付周期(天)'])
df['完成率(%)'] = (df['需求完成数'] / df['需求计划数'] * 100).round(1)
df['缺陷率(%)'] = (df['缺陷数'] / df['需求完成数'] * 100).round(1)

output_path = '/Users/haofuyang/Desktop/onion-code/src/agent/skills/efficiency-report/evals/研发效能数据.xlsx'
df.to_excel(output_path, index=False)
print(f"Created: {output_path}")
print(f"Shape: {df.shape}")
print(f"Columns: {list(df.columns)}")
print(f"\nPer-team summary:")
print(df.groupby('团队')[['需求计划数', '需求完成数', '缺陷数', '代码覆盖率(%)', '平均交付周期(天)', '完成率(%)', '缺陷率(%)']].mean().round(1).to_string())
