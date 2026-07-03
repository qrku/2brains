export type ApplicationStatus =
  | 'planning'  // планирую отправить резюме
  | 'sent'      // резюме отправлено
  | 'waiting'   // жду ответа
  | 'invited'   // приглашение на интервью
  | 'offer'     // оффер
  | 'rejected'; // отказ

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  planning: 'Планирую',
  sent:     'Отправлено',
  waiting:  'Жду ответа',
  invited:  'Приглашение',
  offer:    'Оффер',
  rejected: 'Отказ',
};

export const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as ApplicationStatus[]).map(
  (value) => ({ value, label: STATUS_LABELS[value] })
);

export interface Application {
  id: string;
  company: string;
  position: string;
  url?: string;
  status: ApplicationStatus;
  note?: string;
  createdAt: string;
}
