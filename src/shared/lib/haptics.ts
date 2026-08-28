'use client';

/**
 * Короткий тактильный отклик на жест, который срабатывает без отрыва пальца.
 *
 * Долгое нажатие — жест вслепую: палец стоит на месте, и подтвердить его нечем,
 * кроме анимации под самим пальцем, которую он же и закрывает. Отдача решает это
 * лучше любой картинки.
 *
 * Единого способа нет. `navigator.vibrate` — Android и всё, что на Chromium:
 * Safari его не реализует и, судя по позиции WebKit, не станет. На iOS остаётся
 * обходной путь: с Safari 17.4 переключение `<input type="checkbox" switch>`
 * отдаётся тактильно, как системный тумблер. Прячем такой тумблер за экраном и
 * дёргаем его — отклик приходит, видимых следов не остаётся.
 *
 * Гарантий нет: на iOS до 17.4 и при выключенной в системе отдаче не произойдёт
 * ничего. Поэтому вызов молчаливый — вернуть «получилось» браузер не даёт, и
 * жест обязан оставаться понятным и без вибрации.
 */

/** Тот самый скрытый тумблер: создаётся при первом обращении и живёт до конца сессии. */
let iosSwitch: HTMLLabelElement | null = null;

function iosSwitchTap() {
  if (!iosSwitch) {
    const label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    // Не `display: none`: невидимый для раскладки элемент Safari не переключает,
    // а вместе с ним пропадает и отдача. Поэтому тумблер просто вынесен за экран.
    label.style.cssText =
      'position:fixed;top:-100px;left:-100px;width:1px;height:1px;opacity:0;pointer-events:none;';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    label.appendChild(input);
    document.body.appendChild(label);
    iosSwitch = label;
  }
  // Клик по подписи переключает вложенный флажок — состояние никого не
  // интересует, важен сам щелчок.
  iosSwitch.click();
}

export function haptic() {
  if (typeof navigator === 'undefined' || typeof document === 'undefined') return;

  if (typeof navigator.vibrate === 'function') {
    // 8 мс — на грани различимости: не «звонок», а щелчок.
    navigator.vibrate(8);
    return;
  }
  iosSwitchTap();
}
