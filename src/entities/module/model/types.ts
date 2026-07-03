export interface AppModule {
  id: string;
  label: string;
  href: string;
  description: string;
}

export const ALL_MODULES: AppModule[] = [
  {
    id: 'knowledge',
    label: 'Знания',
    href: '/knowledge',
    description: 'База знаний — темы, конспекты, карточки',
  },
  {
    id: 'tests',
    label: 'Тесты',
    href: '/tests',
    description: 'Тестирование по темам и отслеживание прогресса',
  },
  {
    id: 'problems',
    label: 'Задачи',
    href: '/problems',
    description: 'Трекер алгоритмических задач и паттернов',
  },
  {
    id: 'experience',
    label: 'Опыт',
    href: '/experience',
    description: 'Детали проектов — что рассказывать на интервью',
  },
  {
    id: 'applications',
    label: 'Отклики',
    href: '/applications',
    description: 'Отслеживание вакансий и статуса откликов',
  },
];
