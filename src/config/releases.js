// 最新版本放在最前；每次发版同步 package.json 并运行 npm run changelog。
export const releases = [
  {
    version: '0.2.1',
    date: '2026-09-07',
    title: '每一次变好，都有迹可循',
    changes: [
      {
        type: '新增',
        items: [
          '系统更新日志：在小屋底部查看版本、发布日期与更新内容。',
          '版本记录独立维护，同时生成仓库 CHANGELOG.md。',
        ],
      },
    ],
  },
  {
    version: '0.2.0',
    date: '2026-09-07',
    title: '你好，爪间时光',
    changes: [
      {
        type: '新增',
        items: [
          'Pawstice · 爪间时光：360° 房间探索、家具互动与宠物自主生活。',
          '猫咪与柴犬可选；独立宠物组件支持外观编辑、配置导入与导出。',
          '昼夜氛围、陪伴清单、成长日记、拍照与本地存档。',
        ],
      },
      {
        type: '优化',
        items: [
          '暮蓝、杏橙与暖纸色构成的小屋界面，适配手机操作。',
          '优化宠物身体比例、毛色细节与动作表现，采用程序化半写实模型。',
          '按应用、核心能力、场景与功能模块整理项目，加入自动化检查。',
        ],
      },
    ],
  },
];

export function releaseMarkdown() {
  return (
    '# 系统更新日志\n\n<!-- 由 npm run changelog 生成，请修改 src/config/releases.js。 -->\n\n' +
    releases
      .map(
        (release) =>
          `## ${release.version} · ${release.date}\n\n${release.title}\n\n` +
          release.changes
            .map(
              (group) =>
                `### ${group.type}\n\n${group.items.map((item) => `- ${item}`).join('\n')}\n`,
            )
            .join('\n'),
      )
      .join('\n')
  );
}
