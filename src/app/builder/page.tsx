'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { loadPages, savePages, deletePage } from '@/entities/custom-page';
import type { CustomPage } from '@/entities/custom-page';
import { useWorkspaceStore } from '@/app/providers/WorkspaceStoreProvider';
import { Icon } from '@/shared/ui/Icon';

const EMOJIS = ['📋','📊','🗂️','📌','🏆','🎯','🧩','💡','🔖','📝','🚀','🌟','🔧','📈','🎨'];

export default function ConstructorIndex() {
  const { state: wsState } = useWorkspaceStore();
  const [pages, setPages]     = useState<CustomPage[]>([]);
  const [ready, setReady]     = useState(false);
  const [modal, setModal]     = useState(false);
  const [title, setTitle]     = useState('');
  const [icon,  setIcon]      = useState('📋');

  useEffect(() => {
    if (!wsState.hydrated) return;
    setPages(loadPages(wsState.currentId));
    setReady(true);
  }, [wsState.hydrated, wsState.currentId]);

  const create = () => {
    if (!title.trim()) return;
    const page: CustomPage = {
      id: Math.random().toString(36).slice(2, 9),
      title: title.trim(),
      icon,
      createdAt: Date.now(),
      blocks: [],
    };
    const next = [...pages, page];
    setPages(next);
    savePages(next, wsState.currentId);
    setModal(false);
    setTitle('');
    setIcon('📋');
  };

  const del = (id: string) => {
    deletePage(id, wsState.currentId);
    setPages((ps) => ps.filter((p) => p.id !== id));
  };

  if (!ready) return null;

  return (
    <div className="ctor-index">
      <div className="ctor-index-header">
        <div>
          <h1 className="ctor-index-title">Конструктор</h1>
          <p className="ctor-index-sub">Собирай страницы из блоков под свои задачи</p>
        </div>
        <button className="ctor-new-btn" onClick={() => setModal(true)}><Icon name="add" size={13} /> Новая страница</button>
      </div>

      {pages.length === 0 ? (
        <div className="ctor-empty-state">
          <div className="ctor-empty-icon">🧩</div>
          <div className="ctor-empty-title">Пока нет страниц</div>
          <div className="ctor-empty-sub">Создай первую — собери нужные блоки в любом порядке</div>
          <button className="ctor-new-btn" onClick={() => setModal(true)}><Icon name="add" size={13} /> Создать</button>
        </div>
      ) : (
        <div className="ctor-pages-grid">
          {pages.map((p) => (
            <div key={p.id} className="ctor-page-card">
              <Link href={`/builder/${p.id}`} className="ctor-page-card-link">
                <div className="ctor-page-card-icon">{p.icon}</div>
                <div className="ctor-page-card-title">{p.title}</div>
                <div className="ctor-page-card-meta">
                  {p.blocks.length} блок{p.blocks.length === 1 ? '' : p.blocks.length < 5 ? 'а' : 'ов'}
                  &ensp;·&ensp;
                  {new Date(p.createdAt).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                </div>
              </Link>
              <button className="ctor-page-card-del" onClick={() => del(p.id)} title="Удалить"><Icon name="close" size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="ctor-picker-overlay" onClick={() => setModal(false)}>
          <div className="ctor-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ctor-picker-title">Новая страница</div>
            <div className="ctor-modal-emoji-grid">
              {EMOJIS.map((e) => (
                <button key={e} className={`ctor-emoji-btn${icon === e ? ' active' : ''}`}
                  onClick={() => setIcon(e)}>{e}</button>
              ))}
            </div>
            <input
              className="ctor-modal-input"
              placeholder="Название страницы"
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
            />
            <div className="ctor-modal-actions">
              <button className="ctor-modal-cancel" onClick={() => setModal(false)}>Отмена</button>
              <button className="ctor-new-btn" onClick={create} disabled={!title.trim()}>Создать</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
