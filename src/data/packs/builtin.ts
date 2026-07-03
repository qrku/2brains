import { defaultSections, defaultDoneIds } from '@/entities/section';
import type { BuiltinPackDef } from '@/entities/pack';

const sectionsFor = (ids: string[]) => defaultSections.filter((s) => ids.includes(s.id));

const doneFor = (sections: ReturnType<typeof sectionsFor>) => {
  const topicIds = new Set(sections.flatMap((s) => s.topics.map((t) => t.id)));
  return defaultDoneIds.filter((id) => topicIds.has(id));
};

const jsSections     = sectionsFor(['s0', 's6', 's9']);
const reactSections  = sectionsFor(['s7', 's8', 's10']);
const csSections     = sectionsFor(['s21', 's14', 's16']);

export const builtinPacks: BuiltinPackDef[] = [
  {
    id: 'frontend',
    title: 'Frontend Full',
    description: 'Всё что нужно frontend-разработчику — CSS, JavaScript, React, производительность и алгоритмы',
    category: 'frontend',
    tags: ['CSS', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'HTML', 'Производительность'],
    sections: defaultSections,
    defaultDoneIds,
  },
  {
    id: 'js-core',
    title: 'JavaScript & TypeScript',
    description: 'Основы языка, типизация, event loop, асинхронность и замыкания',
    category: 'frontend',
    tags: ['JavaScript', 'TypeScript', 'Event Loop', 'Async/Await', 'Замыкания'],
    sections: jsSections,
    defaultDoneIds: doneFor(jsSections),
  },
  {
    id: 'react',
    title: 'React & Next.js',
    description: 'Реакт-экосистема, хуки, управление состоянием, SSR и оптимизация',
    category: 'frontend',
    tags: ['React', 'Next.js', 'Hooks', 'SSR', 'State Management'],
    sections: reactSections,
    defaultDoneIds: doneFor(reactSections),
  },
  {
    id: 'cs',
    title: 'Алгоритмы & Архитектура',
    description: 'Структуры данных, паттерны проектирования, FSD и системное мышление',
    category: 'cs',
    tags: ['Алгоритмы', 'Паттерны', 'Архитектура', 'FSD', 'ООП'],
    sections: csSections,
    defaultDoneIds: doneFor(csSections),
  },
];
